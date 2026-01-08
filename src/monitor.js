const fs = require('fs');
const config = require("./config/config");
const Logger = require("./utils/logger");
const BrowserManager = require("./utils/browser");
const Mailer = require('./utils/mailer');
const DateUtils = require('./utils/date');
const uuidv4 = require('uuid').v4;

class WebMonitor {
    constructor() {
        this.logger = new Logger(config.logging);
        this.browserManager = new BrowserManager(config, this.logger);
        this.mailer = new Mailer(config.mailer, this.logger);
        this.isTestMode = process.argv.includes("--test");
        this.id = null;
        this.mailAttatchments = [];
    }

    async run() {
        this.id = uuidv4();
        this.logger.identifier(this.id);
        this.mailer.initialize(this.id);

        const startTime = Date.now();
        this.logger.info("=== INICIANDO MONITOREO ===", {
            id: this.id,
            url: config.monitor.url,
            target: config.monitor.targetData,
            testMode: this.isTestMode,
        });

        try {
            await this.browserManager.initialize(this.id);
            await this.browserManager.navigate(config.monitor.url);
            await this.browserManager.takeScreenshot("001_first_load");

            const data = await this.extractData();

            await this.processData(data);
            await this.searchOptionsManually();
            await this.sendNotifications();

            const duration = Date.now() - startTime;
            this.logger.info("=== MONITOREO COMPLETADO ===", {
                id: this.id,
                duration: `${duration}ms`,
                success: true,
            });
        } catch (error) {
            this.logger.error("Error en el monitoreo", {
                error: error.message,
                stack: error.stack,
            });

            await this.browserManager.takeScreenshot("error");

            if (!this.isTestMode) {
                process.exit(1);
            }
        } finally {
            await this.browserManager.cleanup();
        }
    }

    async sendNotifications() {
        if (this.mailAttatchments.length === 0) {
            this.logger.info('No hay adjuntos para enviar. No se enviará correo.');
            return;
        }
        if (!this.isTestMode) {
            this.logger.info('MODO TEST: se habria enviado notificacion.');
            return;
        }

        await this.mailer.sendAvailable({ url: config.monitor.url }, this.mailAttatchments);
    }

    addAttatchment(filename, path) {
        this.mailAttatchments.push({ filename, path: this.browserManager.getScreenshot(path) });
    }

    async searchOptionsManually() {
        const page = this.browserManager.getPage();
        try {
            this.logger.info('Iniciando búsqueda manual de opciones...');
            const locator = page.locator('[aria-label$=". Horas disponibles"]')
            const count = await locator.count();
            if (count > 0) {
                this.logger.info(`Se encontraron ${count} opciones disponibles manualmente.`);
                this.browserManager.takeScreenshot("005_manual_options_found");
                this.addAttatchment('page_manual.png', '005_manual_options_found');
            }else{
                this.logger.info('No se encontraron opciones disponibles manualmente.');
            }
        } catch (error) {
            this.logger.error('Error buscando opciones manualmente', { error: error.message });
        } finally {
            this.logger.info('Búsqueda manual de opciones completada.');
        }
    }

    async extractData() {
        const page = this.browserManager.getPage();

        try {
            await page.locator('text=Mostrar más servicios').click();
            await this.browserManager.takeScreenshot("002_show_more_services_click");

            const apiResponsePromise = page.waitForResponse(
                response => response.url().includes('Atencinalpblico@cancilleria.gov.co/GetStaffAvailability') &&
                    response.status() === 200,
                { timeout: 6000 }
            );

            await page.locator('input[aria-label="Cédula Primera vez"] + label').click();
            await this.browserManager.takeScreenshot("003_birth_certificate_service_click");

            this.logger.info('Esperando respuesta de API de disponibilidad...');
            const response = await apiResponsePromise;
            const availabilityData = await response.json();
            this.logger.info('API de Bookings respondió', {
                status: response.status(),
                url: response.url(),
            });

            await this.browserManager.takeScreenshot("004_api_response_received");

            return {
                availability: availabilityData.staffAvailabilityResponse, // datos directos de la API
                timestamp: new Date().toISOString(),
                apiStatus: response.status()
            };

        } catch (error) {
            this.logger.error('Error extrayendo datos', { error: error.message });
            throw error;
        }
    }

    async processData(data) {
        this.saveRawData(data);
        try {
            if (!data.availability || !Array.isArray(data.availability)) {
                throw new Error('Datos de disponibilidad inválidos o no encontrados');
            }

            const availabilityAnalysis = this.analyzeAvailability(data.availability);

            this.logger.info('Análisis de disponibilidad:', {
                hasAvailability: availabilityAnalysis.hasAvailability,
                totalAvailable: availabilityAnalysis.totalAvailableSlots
            });

            if (availabilityAnalysis.hasAvailability) {
                this.logger.info('🎉 HAY DISPONIBILIDAD!', {
                    totalSlots: availabilityAnalysis.totalAvailableSlots,
                    slots: availabilityAnalysis.availableSlots
                });

                const lastState = await this.getLatestState();
                if (lastState && lastState.hasAvailability && lastState.totalAvailableSlots === availabilityAnalysis.totalAvailableSlots) {
                    this.logger.info('La disponibilidad ya fue notificada previamente. No se enviará otra notificación.');
                    await this.saveCurrentState(availabilityAnalysis);
                    return;
                }

                this.addAttatchment('page.png', '004_api_response_received');
            } else {
                this.logger.info('No hay disponibilidad - todos los slots están ocupados o fuera de oficina');
            }

            await this.saveCurrentState(availabilityAnalysis);

        } catch (error) {
            this.logger.error('Error procesando datos', { error: error.message });
            throw error;
        }
    }

    analyzeAvailability(staffAvailabilityResponse) {
        const unavailableStatuses = {
            BOOKINGSAVAILABILITYSTATUS_BUSY: false,
            BOOKINGSAVAILABILITYSTATUS_OUT_OF_OFFICE: false,
        };

        let hasAvailability = false;
        const availableSlots = [];

        this.logger.debug('Analizando disponibilidad del personal...', { staff: staffAvailabilityResponse });

        staffAvailabilityResponse.forEach((staff) => {
            const staffId = staff.staffId;

            staff.availabilityItems.forEach((item) => {
                if (unavailableStatuses[item.status] === undefined) {
                    const differenceInMinutes = DateUtils.differenceInMinutes(item.startDateTime.dateTime, item.endDateTime.dateTime);
                    // Segun observaciones, solo considerar slots de 20 minutos o más
                    if (differenceInMinutes >= 20) {
                        hasAvailability = true;

                        availableSlots.push({
                            staffId: staffId,
                            status: item.status,
                            startDateTime: item.startDateTime,
                            endDateTime: item.endDateTime,
                            serviceId: item.serviceId
                        });
                    }
                }
            });
        });

        return {
            hasAvailability,
            availableSlots,
            totalAvailableSlots: availableSlots.length
        };
    }

    async saveRawData(data) {
        const rawFile = `records/states/data/raw-${this.id}.json`;

        try {
            fs.writeFileSync(rawFile, JSON.stringify(data, null, 2));
            this.logger.debug('Datos crudos guardados', { file: rawFile });
        } catch (error) {
            this.logger.warn('Error guardando datos crudos', { error: error.message });
        }
    }

    async saveCurrentState(analysis) {
        const stateFile = 'records/states/last-state.json';
        const statesFile = 'records/states/states.json';
        let states = [];

        try {
            if (fs.existsSync(statesFile)) {
                const rawData = fs.readFileSync(statesFile);
                states = JSON.parse(rawData);
            }
        } catch (error) {
            this.logger.warn('Error leyendo estados previos', { error: error.message });
        }

        const state = {
            id: this.id,
            timestamp: new Date().toISOString(),
            hasAvailability: analysis.hasAvailability,
            totalAvailableSlots: analysis.totalAvailableSlots,
            lastCheck: new Date().toISOString()
        };

        states.unshift(state);

        try {
            fs.writeFileSync(statesFile, JSON.stringify(states, null, 2));
            fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
            this.logger.debug('Estado guardado', { file: stateFile });
        } catch (error) {
            this.logger.warn('Error guardando estado', { error: error.message });
        }
    }

    async getLatestState() {
        const stateFile = 'records/states/last-state.json';

        try {
            if (fs.existsSync(stateFile)) {
                const rawData = fs.readFileSync(stateFile);
                return JSON.parse(rawData);
            } else {
                u
                this.logger.info('No se encontró estado previo');
                return null;
            }
        } catch (error) {
            this.logger.warn('Error leyendo estado previo', { error: error.message });
            return null;
        }
    }
}

if (require.main === module) {
    const monitor = new WebMonitor();
    monitor.run().catch(error => {
        console.error('Error fatal:', error);
        process.exit(1);
    });
}

module.exports = WebMonitor;
