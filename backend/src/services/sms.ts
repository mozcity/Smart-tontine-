import { config } from '../config.js';

export interface SmsSender { send(phone: string, text: string): Promise<void> }

const consoleSender: SmsSender = {
  async send(phone, text) {
    if (config.env !== 'test') console.log(`[SMS → ${phone}] ${text}`);
  },
};

// En production : Orange SMS API (CI), Twilio, ou un agrégateur local (ex. LeTexto, MTarget).
export const sms: SmsSender = consoleSender;
