const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class BrowserManager {
  constructor(config, logger) {
    this.flowId = null;
    this.config = config;
    this.logger = logger;
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async initialize(flowId) {
    this.flowId = flowId;
    try {
      this.logger.info('Inicializando navegador...');
      
      this.browser = await chromium.launch(this.config.browser);
      this.logger.debug('Navegador lanzado', { headless: this.config.browser.headless });

      this.context = await this.browser.newContext(this.config.context);
      this.logger.debug('Contexto creado');

      this.page = await this.context.newPage();
      this.logger.debug('Página creada');

      // Configurar timeouts
      this.page.setDefaultTimeout(this.config.browser.timeout);
      this.page.setDefaultNavigationTimeout(this.config.browser.timeout);

      // Event listeners útiles para debugging
      this.page.on('console', msg => {
        if (msg.type() === 'error') {
          this.logger.warn('Console error en la página', { text: msg.text() });
        }
      });

      this.page.on('pageerror', error => {
        this.logger.error('Error JavaScript en la página', { error: error.message });
      });

      return true;
    } catch (error) {
      this.logger.error('Error inicializando navegador', { error: error.message });
      await this.cleanup();
      throw error;
    }
  }

  async navigate(url) {
    try {
      this.logger.info('Navegando a URL', { url });
      
      const response = await this.page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: this.config.monitor.timeout 
      });

      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
      }

      this.logger.info('Navegación exitosa', { 
        status: response.status(),
        url: response.url() 
      });

      return response;
    } catch (error) {
      this.logger.error('Error en navegación', { 
        url, 
        error: error.message 
      });
      
      // Screenshot para debugging si falla
      await this.takeScreenshot('navigation_error');
      throw error;
    }
  }

  async createDirectoryIfNotExists(dir) {
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async takeScreenshot(name = 'screenshot') {
    if (this.page) {
      const timestamp = new Date().toISOString();
      const folder = `records/screenshots/${timestamp.split('T')[0].replace(/-/g, '_')}/${this.flowId}`;
      const filename = `${folder}/${name}.png`;

      try {
        await this.createDirectoryIfNotExists(folder);
        await this.page.screenshot({ 
          path: filename, 
          fullPage: true 
        });
        this.logger.info('Screenshot guardado', { filename });
        return filename;
      } catch (error) {
        this.logger.warn('Error guardando screenshot', { error: error.message });
      }
    }
  }

  getScreenshot(name = 'screenshot') {
    const timestamp = new Date().toISOString();
    const folder = `records/screenshots/${timestamp.split('T')[0].replace(/-/g, '_')}/${this.flowId}`;
    return path.resolve(`${folder}/${name}.png`);
  }

  async cleanup() {
    try {
      if (this.context) {
        await this.context.close();
        this.logger.debug('Contexto cerrado');
      }
      
      if (this.browser) {
        await this.browser.close();
        this.logger.debug('Navegador cerrado');
      }
    } catch (error) {
      this.logger.warn('Error en cleanup', { error: error.message });
    }
  }

  getPage() {
    return this.page;
  }
}

module.exports = BrowserManager;
