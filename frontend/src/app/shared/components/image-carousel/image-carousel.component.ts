import { Component, Input, Output, EventEmitter, HostListener, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookingImageInfo } from '../../models/booking.model';

@Component({
  selector: 'app-image-carousel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-carousel.component.html',
  styleUrls: ['./image-carousel.component.scss'],
})
export class ImageCarouselComponent implements OnChanges {
  @Input() images: BookingImageInfo[] = [];
  @Input() startIndex: number = 0;
  @Output() closed = new EventEmitter<void>();

  currentIndex = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['startIndex'] || changes['images']) {
      this.currentIndex = this.startIndex;
    }
  }

  get currentImage(): string {
    return this.images[this.currentIndex]?.url || '';
  }

  get currentImageTimestamp(): string {
    const createdAt = this.images[this.currentIndex]?.createdAt;
    if (!createdAt) return '';
    return new Date(createdAt).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  get total(): number {
    return this.images.length;
  }

  prev(): void {
    this.currentIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.total - 1;
  }

  next(): void {
    this.currentIndex = this.currentIndex < this.total - 1 ? this.currentIndex + 1 : 0;
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('carousel-overlay')) {
      this.close();
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape':
        this.close();
        break;
      case 'ArrowLeft':
        this.prev();
        break;
      case 'ArrowRight':
        this.next();
        break;
    }
  }
}
