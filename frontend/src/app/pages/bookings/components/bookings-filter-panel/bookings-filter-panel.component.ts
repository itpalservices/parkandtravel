import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { DateRangePickerComponent, DateRange } from '../../../../shared/components/date-range-picker/date-range-picker.component';
import { BookingSortField, BookingsFilterState } from '../../../../shared/models/booking.model';
import { BOOKING_STATUS_OPTIONS, BOOKING_STATUS_OPTIONS_LABELS } from '../../../../shared/statics/booking-status.model';
import { CAR_DROP_OFF_OPTIONS, CAR_DROP_OFF_OPTIONS_LABELS } from '../../../../shared/statics/car-drop-off.model';
import { CAR_PICK_UP_OPTIONS, CAR_PICK_UP_OPTIONS_LABELS } from '../../../../shared/statics/car-pick-up.model';

interface Option {
  id: string;
  label: string;
}

@Component({
  selector: 'app-bookings-filter-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, DateRangePickerComponent],
  templateUrl: './bookings-filter-panel.component.html',
  styleUrls: ['./bookings-filter-panel.component.scss'],
})
export class BookingsFilterPanelComponent implements OnInit {
  @Input() state!: BookingsFilterState;
  @Input() isAdmin = false;
  @Input() isUser = false;
  @Input() enablePastDates = false;
  @Input() checkInByOptions: string[] = [];
  @Input() checkOutByOptions: string[] = [];

  @Output() apply = new EventEmitter<BookingsFilterState>();
  @Output() reset = new EventEmitter<void>();

  private activeOffcanvas = inject(NgbActiveOffcanvas);

  draft!: BookingsFilterState;

  readonly statusOptions: Option[] = [
    { id: BOOKING_STATUS_OPTIONS.created, label: BOOKING_STATUS_OPTIONS_LABELS.created },
    { id: BOOKING_STATUS_OPTIONS.parked, label: BOOKING_STATUS_OPTIONS_LABELS.parked },
    { id: BOOKING_STATUS_OPTIONS.completed, label: BOOKING_STATUS_OPTIONS_LABELS.completed },
  ];

  readonly parkingTypeOptions: Option[] = [
    { id: 'parkingType_covered', label: 'Covered' },
    { id: 'parkingType_uncovered', label: 'Uncovered' },
  ];

  readonly dropOffOptions: Option[] = [
    { id: CAR_DROP_OFF_OPTIONS.selfDropOff, label: CAR_DROP_OFF_OPTIONS_LABELS.selfDropOff },
    { id: CAR_DROP_OFF_OPTIONS.airportPickUp, label: CAR_DROP_OFF_OPTIONS_LABELS.airportPickUp },
  ];

  readonly pickUpOptions: Option[] = [
    { id: CAR_PICK_UP_OPTIONS.selfPickUp, label: CAR_PICK_UP_OPTIONS_LABELS.selfPickUp },
    { id: CAR_PICK_UP_OPTIONS.deliveryToAirport, label: CAR_PICK_UP_OPTIONS_LABELS.deliveryToAirport },
  ];

  readonly washServiceOptions: Option[] = [
    { id: 'yes', label: 'Yes' },
    { id: 'no', label: 'No' },
  ];

  readonly sourceOptions: Option[] = [
    { id: 'registered', label: 'Registered User' },
    { id: 'guest', label: 'Guest' },
  ];

  private readonly allSortFieldOptions: (Option & { id: BookingSortField; adminOnly?: boolean })[] = [
    { id: 'status', label: 'Status' },
    { id: 'name', label: 'Full Name' },
    { id: 'plateNo', label: 'Plate No.' },
    { id: 'vehicle', label: 'Vehicle / Model' },
    { id: 'carColor', label: 'Vehicle Color' },
    { id: 'checkIn', label: 'Check In' },
    { id: 'checkInBy', label: 'Check In By', adminOnly: true },
    { id: 'dropOff', label: 'Car Drop-off' },
    { id: 'checkOut', label: 'Check Out' },
    { id: 'checkOutBy', label: 'Check Out By', adminOnly: true },
    { id: 'pickUp', label: 'Car Pick-up' },
    { id: 'returnFlight', label: 'Flight No.' },
    { id: 'parkingType', label: 'Parking Type' },
    { id: 'washService', label: 'Wash Service' },
    { id: 'source', label: 'Source', adminOnly: true },
    { id: 'finalPrice', label: 'Price' },
  ];

  get sortFieldOptions(): Option[] {
    return this.allSortFieldOptions.filter((o) => this.isAdmin || !o.adminOnly);
  }

  ngOnInit(): void {
    this.draft = {
      ...this.state,
      status: [...this.state.status],
      parkingType: [...this.state.parkingType],
      washService: [...this.state.washService],
      dropOff: [...this.state.dropOff],
      pickUp: [...this.state.pickUp],
      source: [...this.state.source],
    };
  }

  get selectedFromDate(): Date | null {
    return this.parseApiDate(this.draft.dateFrom);
  }

  get selectedToDate(): Date | null {
    return this.parseApiDate(this.draft.dateTo);
  }

  onDateRangeChange(range: DateRange): void {
    this.draft.dateFrom = range.from ? this.formatDateForApi(range.from) : null;
    this.draft.dateTo = range.to ? this.formatDateForApi(range.to) : null;
    this.draft.datePreset = range.preset;
  }

  toggleInArray(list: string[], value: string): void {
    const idx = list.indexOf(value);
    if (idx === -1) {
      list.push(value);
    } else {
      list.splice(idx, 1);
    }
  }

  onApply(): void {
    this.apply.emit(this.draft);
    this.activeOffcanvas.close();
  }

  onReset(): void {
    this.reset.emit();
    this.activeOffcanvas.close();
  }

  onDismiss(): void {
    this.activeOffcanvas.dismiss();
  }

  private parseApiDate(dateStr: string | null): Date | null {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  private formatDateForApi(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
