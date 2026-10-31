import nodemailer from 'nodemailer';
import { config } from '../config.js';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type MailSender = (mail: Mail) => Promise<void>;

async function smtpOrConsole(mail: Mail): Promise<void> {
  const { smtp } = config();
  if (!smtp.host) {
    // Development: no mail server, print instead.
    console.log(`\n--- mail to ${mail.to} ---\n${mail.subject}\n\n${mail.text}\n---\n`);
    return;
  }
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });
  await transport.sendMail({ from: smtp.from, ...mail });
}

let sender: MailSender = smtpOrConsole;

export function setMailSender(fn: MailSender | null): void {
  sender = fn ?? smtpOrConsole;
}

export function sendMail(mail: Mail): Promise<void> {
  return sender(mail);
}
