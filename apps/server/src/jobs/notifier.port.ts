/**
 * Puerto de notificaciones: la frontera entre "hay que avisar a alguien" y el
 * canal (Slack, Google Chat, correo, notificación in-app). El CRM y los
 * comentarios solo conocen esta interfaz. La implementación por defecto escribe
 * en el log; registra la tuya en `NotifierModule`.
 */
export interface Notification {
  type: 'mention' | 'reply' | 'digest';
  /** Ids de miembro (correo en minúscula). Vacío en un digest de equipo. */
  recipients: string[];
  actor?: { email: string; name: string };
  entity_type?: string;
  entity_id?: string;
  entity_label?: string | null;
  note_id?: string;
  body: string;
}

export interface NotifierPort {
  notify(notification: Notification): Promise<void>;
}

export const NOTIFIER = Symbol('NOTIFIER');
