export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                // Return only the Base64 part, without the "data:mime/type;base64," prefix.
                const base64Content = reader.result.split(',')[1];
                resolve(base64Content);
            } else {
                reject(new Error("Failed to read file as a Base64 string."));
            }
        };
        reader.onerror = (error) => reject(error);
    });
};
