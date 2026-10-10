export interface ExportOptions {
  /** Camera / object name in the target application. */
  readonly name: string;
  /** Sensor (film back) width in mm, mapped onto the image's longest side. Only changes the mm readout, never the framing. */
  readonly sensorWidthMm: number;
  /** Absolute path of the source photo, used as background / image plane when the target supports it. */
  readonly imagePath: string | null;
}
