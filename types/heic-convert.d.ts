declare module "heic-convert" {
  const convert: (o: { buffer: Buffer | ArrayBuffer; format: "JPEG" | "PNG"; quality?: number }) => Promise<ArrayBuffer>;
  export default convert;
}
