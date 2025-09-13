const nodemailer = require('nodemailer');

class Mailer {
    constructor(config, logger) {
        this.flowId = null;
        this.config = config;
        this.logger = logger;
        this.transporter = null;
    }

    initialize(flowId) {
        this.flowId = flowId;
        this.transporter = nodemailer.createTransport({
            service: this.config.service,
            auth: {
                user: this.config.auth.user,
                pass: this.config.auth.pass
            }
        });
        this.logger.info('Mailer initialized', { flowId });
    }

    async sendAvailable(data, attachments = []) {
        this.logger.info('Enviando notificacion:', { attachments });
        const info = await this.transporter.sendMail({
            from: `${this.config.auth.fromName} <${this.config.auth.user}>`,
            to: this.config.to,
            cc: this.config.cc,
            subject: `🚨 ¡Cita disponible en el Consulado! - Flujo ${this.flowId}`,
            text: `
            Buenas noticias 🎉

            Se ha detectado una cita disponible en la página que estás monitoreando.

            ✅ Entra y reserva tu cita antes de que alguien más lo haga.
            👉 ${data.url}

            -- 
            Este correo fue generado automáticamente por tu bot con Playwright + Node.js 💻`,
            html: `
            <div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px;">
                <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); padding: 20px;">
                
                <h2 style="color: #2c3e50; font-size: 22px; margin-bottom: 10px;">🎉 ¡Buenas noticias!</h2>
                <p style="color: #555; font-size: 16px; line-height: 1.5;">
                    Se ha detectado una <strong style="color:#27ae60;">cita disponible</strong> en la página que estás monitoreando.
                </p>
                
                <div style="background-color: #ecfdf5; border-left: 5px solid #27ae60; padding: 15px; margin: 20px 0; border-radius: 5px;">
                    <p style="margin:0; color:#064e3b; font-size: 15px;">
                    ✅ Ya puedes entrar y reservar tu cita antes de que alguien más lo haga.
                    </p>
                </div>
                
                <a href="${data.url}" target="_blank"
                    style="display: inline-block; padding: 12px 20px; background-color: #27ae60; color: #ffffff; 
                            text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">
                    Reservar ahora
                </a>
                
                <hr style="margin: 25px 0; border: none; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #888; text-align: center;">
                    Este correo fue generado automáticamente por tu bot con Playwright + Node.js 💻
                </p>
                </div>
            </div>`,
            attachments: attachments
        });
        this.logger.info('Notificacion enviada', { messageId: info.messageId });
    }
}

module.exports = Mailer;