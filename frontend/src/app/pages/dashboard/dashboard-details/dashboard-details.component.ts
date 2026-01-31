import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal, NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../../core/services/api.service';

export interface DashboardDetailItem {
  id: string;
  plateNo: string;
  vehicleModel: string;
  checkIn: string;
  checkOut: string;
}

export type CardType = 'total-cars' | 'today-check-ins' | 'today-check-outs' | 'wash-today' | 'wash-tomorrow';

@Component({
  selector: 'app-dashboard-details',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbPaginationModule],
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

  Math = Math;

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

  onPageChange(): void {
    this.updateDisplayedItems();
  }

  private filterAndPaginate(): void {
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      this.filteredItems = this.allItems.filter(item =>
        item.plateNo.toLowerCase().includes(term) ||
        item.vehicleModel.toLowerCase().includes(term) ||
        item.checkIn.toLowerCase().includes(term) ||
        item.checkOut.toLowerCase().includes(term)
      );
    } else {
      this.filteredItems = [...this.allItems];
    }
    this.updateDisplayedItems();
  }

  private updateDisplayedItems(): void {
    const startIndex = (this.page - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.displayedItems = this.filteredItems.slice(startIndex, endIndex);
  }

  close(): void {
    this.activeModal.dismiss();
  }
}
