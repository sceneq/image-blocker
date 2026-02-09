import { MIN_IMAGE_SIZE, IMAGE_STATUS_ATTR } from "@/shared/constants";
import { startPending } from "./image-filter";
import type { PendingStyle } from "@/shared/types";

export type ImageCallback = (img: HTMLImageElement) => void;

export class ImageObserver {
  private observer: MutationObserver | null = null;

  constructor(
    private callback: ImageCallback,
    private pendingStyle: PendingStyle,
    private querySelector: string = "img",
  ) {}

  start(): void {
    // Process existing images
    const imgs = document.querySelectorAll<HTMLImageElement>(
      this.querySelector
    );
    for (const img of imgs) {
      this.processImage(img);
    }

    // Watch for newly added or changed elements
    this.observer = new MutationObserver((mutations) => {
      for (const { type, addedNodes, attributeName, target } of mutations) {
        if (type === "childList") {
          for (const node of addedNodes) {
            if (node instanceof HTMLImageElement) this.processImage(node);
            if (node instanceof HTMLElement) {
              for (const img of node.querySelectorAll<HTMLImageElement>(
                this.querySelector
              )) {
                this.processImage(img);
              }
            }
          }
        }

        // src has changed
        if (
          type === "attributes" &&
          attributeName === "src" &&
          target instanceof HTMLImageElement
        ) {
          // re-process
          target.removeAttribute(IMAGE_STATUS_ATTR);
          this.processImage(target);
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"],
    });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  private processImage(img: HTMLImageElement): void {
    // Already processed
    if (img.getAttribute(IMAGE_STATUS_ATTR)) return;

    const checkAndProcess = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      // Check size against natural size or display size
      if (w < MIN_IMAGE_SIZE || h < MIN_IMAGE_SIZE) return;

      // Prevent duplicate processing
      if (img.getAttribute(IMAGE_STATUS_ATTR)) return;
      img.setAttribute(IMAGE_STATUS_ATTR, "pending");

      // Show loading animation during inference
      startPending(img, this.pendingStyle);
      this.callback(img);
    };

    if (img.complete && img.naturalWidth > 0) {
      checkAndProcess();
    } else {
      img.addEventListener("load", checkAndProcess, { once: true });
    }
  }
}
