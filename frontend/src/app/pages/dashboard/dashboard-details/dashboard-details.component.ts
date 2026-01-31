import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../../core/services/api.service';

export interface DashboardDetailItem {
  id: string;
  customerName: string;
  plateNo: string;
  vehicleModel: string;
  checkIn: string;
  checkOut: string;
}

export type CardType = 'total-cars' | 'today-check-ins' | 'today-check-outs' | 'wash-today' | 'wash-tomorrow';

@Component({
  selector: 'app-dashboard-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard-details.component.html',
  styleUrl: './dashboard-details.component.scss'
})
export class DashboardDetailsComponent implements OnInit {
  private apiService = inject(ApiService);
  public activeModal = inject(NgbActiveModal);

  @Input() cardType!: CardType;
  @Input() cardTitle!: string;

  allItems: DashboardDetailItem[] = [];
  filteredItems: DashboardDetailItem[] = [];
  displayedItems: DashboardDetailItem[] = [];

  loading = true;
  searchTerm = '';
  page = 1;
  pageSize = 20;
  totalPages = 1;
  pageNumbers: number[] = [];

  private cardTitles: Record<CardType, string> = {
    'total-cars': 'Total Cars',
    'today-check-ins': 'Today Check-In',
    'today-check-outs': 'Today Check-Out',
    'wash-today': 'Cars for Wash Today',
    'wash-tomorrow': 'Cars for Wash Tomorrow'
  };

  ngOnInit(): void {
    if (!this.cardTitle) {
      this.cardTitle = this.cardTitles[this.cardType] || 'Details';
    }
    this.loadDetails();
  }

  private loadDetails(): void {
    this.loading = true;
    this.apiService.get<DashboardDetailItem[]>(`/dashboard/card-details?cardType=${this.cardType}`).subscribe({
      next: (items) => {
        this.allItems = items;
        this.filterAndPaginate();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading card details:', err);
        this.loading = false;
      }
    });
  }

  onSearchChange(): void {
    this.page = 1;
    this.filterAndPaginate();
  }

  private filterAndPaginate(): void {
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      this.filteredItems = this.allItems.filter(item =>
        item.customerName.toLowerCase().includes(term) ||
        item.plateNo.toLowerCase().includes(term) ||
        item.vehicleModel.toLowerCase().includes(term) ||
        item.checkIn.toLowerCase().includes(term) ||
        item.checkOut.toLowerCase().includes(term)
      );
    } else {
      this.filteredItems = [...this.allItems];
    }
    this.totalPages = Math.ceil(this.filteredItems.length / this.pageSize);
    this.calculatePageNumbers();
    this.updateDisplayedItems();
  }

  private updateDisplayedItems(): void {
    const startIndex = (this.page - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.displayedItems = this.filteredItems.slice(startIndex, endIndex);
  }

  private calculatePageNumbers(): void {
    this.pageNumbers = [];
    const maxPagesToShow = 5;

    if (this.totalPages <= maxPagesToShow) {
      for (let i = 1; i <= this.totalPages; i++) {
        this.pageNumbers.push(i);
      }
    } else {
      this.pageNumbers.push(1);

      let startPage = Math.max(2, this.page - 1);
      let endPage = Math.min(this.totalPages - 1, this.page + 1);

      if (this.page <= 3) {
        endPage = 4;
      }
      if (this.page >= this.totalPages - 2) {
        startPage = this.totalPages - 3;
      }

      if (startPage > 2) {
        this.pageNumbers.push(-1);
      }

      for (let i = startPage; i <= endPage; i++) {
        this.pageNumbers.push(i);
      }

      if (endPage < this.totalPages - 1) {
        this.pageNumbers.push(-1);
      }

      this.pageNumbers.push(this.totalPages);
    }
  }

  onPageClick(pageNum: number): void {
    if (pageNum !== this.page && pageNum >= 1 && pageNum <= this.totalPages) {
      this.page = pageNum;
      this.calculatePageNumbers();
      this.updateDisplayedItems();
    }
  }

  onPreviousPage(): void {
    if (this.page > 1) {
      this.page--;
      this.calculatePageNumbers();
      this.updateDisplayedItems();
    }
  }

  onNextPage(): void {
    if (this.page < this.totalPages) {
      this.page++;
      this.calculatePageNumbers();
      this.updateDisplayedItems();
    }
  }

  close(): void {
    this.activeModal.dismiss();
  }
}
