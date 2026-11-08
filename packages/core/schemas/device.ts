import { z } from 'zod';
import { TimestampSchema } from './common';

/**
 * `devices/{token}`: one browser or phone that gets scout's push notifications through Firebase
 * Cloud Messaging (#12). The token is what the dashboard registers: its Firebase Installation ID,
 * which firebase-admin 14 sends to. It is the document ID, and it is never logged.
 */
export const DeviceSchema = z.strictObject({
  token: z
    .string()
    .min(1)
    .max(4096)
    .regex(/^[^/]+$/, 'a device token never contains "/"'),
  /** What it is, for the Settings page: "iPhone home screen", "Chrome on the Mac". */
  label: z.string().min(1).nullable(),
  addedAt: TimestampSchema,
});
export type Device = z.infer<typeof DeviceSchema>;
