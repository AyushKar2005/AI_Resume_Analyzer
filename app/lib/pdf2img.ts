// Import the worker URL correctly with ?url to get the worker file URL from the bundler
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Interface for the conversion result
export interface PdfConversionResult {
    imageUrl: string;
    file: File | null;
    error?: string;
}

let pdfjsLib: any = null;
let isLoading = false;
let loadPromise: Promise<any> | null = null;

// Load PDF.js library and set worker source dynamically
async function loadPdfJs(): Promise<any> {
    if (pdfjsLib) return pdfjsLib;
    if (loadPromise) return loadPromise;

    isLoading = true;

    // Import the main pdfjs-dist library (non-.mjs for better compatibility)
    loadPromise = import('pdfjs-dist/build/pdf').then((lib) => {
        // Set the workerSrc to the imported worker file URL
        lib.GlobalWorkerOptions.workerSrc = workerSrc;
        pdfjsLib = lib;
        isLoading = false;
        return lib;
    });

    return loadPromise;
}

// Convert first page of PDF file to a PNG image blob URL and file object
export async function convertPdfToImage(
    file: File
): Promise<PdfConversionResult> {
    try {
        const lib = await loadPdfJs();

        // Read PDF file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Load the PDF document
        const pdf = await lib.getDocument({ data: arrayBuffer }).promise;

        // Get the first page
        const page = await pdf.getPage(1);

        // Set viewport scale (4x for high-resolution image)
        const viewport = page.getViewport({ scale: 4 });

        // Create a canvas to render the PDF page
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (context) {
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
        }

        // Render the PDF page on the canvas
        await page.render({ canvasContext: context!, viewport }).promise;

        // Convert the canvas content to a blob (PNG) and create a File object from it
        return new Promise((resolve) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        const originalName = file.name.replace(/\.pdf$/i, '');
                        const imageFile = new File([blob], `${originalName}.png`, {
                            type: 'image/png',
                        });

                        resolve({
                            imageUrl: URL.createObjectURL(blob),
                            file: imageFile,
                        });
                    } else {
                        resolve({
                            imageUrl: '',
                            file: null,
                            error: 'Failed to create image blob',
                        });
                    }
                },
                'image/png',
                1.0 // maximum quality
            );
        });
    } catch (err: any) {
        console.error('PDF conversion failed:', err);
        return {
            imageUrl: '',
            file: null,
            error: `Failed to convert PDF: ${err?.message ?? String(err)}`,
        };
    }
}
