export function readImage(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type))
    return Promise.reject(
      new Error("Выберите изображение PNG, JPEG, WebP или GIF"),
    );
  if (file.size > 3 * 1024 * 1024)
    return Promise.reject(new Error("Изображение должно быть меньше 3 МБ"));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось открыть изображение"));
    reader.readAsDataURL(file);
  });
}
