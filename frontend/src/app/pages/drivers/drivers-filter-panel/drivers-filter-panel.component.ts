import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveOffcanvas, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { DriverSortField, DriversFilterState } from '../../../shared/models/driver.model';
import { PhoneCode } from '../../../shared/models/phone-codes.model';

interface Option {
  id: string;
  label: string;
}

@Component({
  selector: 'app-drivers-filter-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbDropdownModule],
  templateUrl: './drivers-filter-panel.component.html',
  styleUrls: ['./drivers-filter-panel.component.scss'],
})
export class DriversFilterPanelComponent implements OnInit {
  @Input() state!: DriversFilterState;
  @Input() phoneCodes: PhoneCode[] = [];

  @Output() apply = new EventEmitter<DriversFilterState>();
  @Output() reset = new EventEmitter<void>();

  private activeOffcanvas = inject(NgbActiveOffcanvas);

  draft!: DriversFilterState;
  phoneCodeSearch = '';

  readonly statusOptions: Option[] = [
    { id: 'active', label: 'Active' },
    { id: 'inactive', label: 'Inactive' },
  ];

  readonly sortFieldOptions: (Option & { id: DriverSortField })[] = [
    { id: 'name', label: 'Full Name' },
    { id: 'email', label: 'Email' },
    { id: 'phoneCode', label: 'Phone Code' },
    { id: 'phone', label: 'Phone' },
    { id: 'status', label: 'Status' },
  ];

  ngOnInit(): void {
    this.draft = {
      ...this.state,
      status: [...this.state.status],
    };
  }

  get selectedPhoneCode(): PhoneCode | null {
    return this.phoneCodes.find((c) => c.phoneCode === this.draft.phoneCode) ?? null;
  }

  get filteredPhoneCodes(): PhoneCode[] {
    const search = this.phoneCodeSearch.toLowerCase().trim();
    if (!search) return this.phoneCodes;
    return this.phoneCodes.filter(
      (c) => c.isoCode.toLowerCase().includes(search) || c.phoneCode.includes(search)
    );
  }

  selectPhoneCode(code: PhoneCode | null): void {
    this.draft.phoneCode = code ? code.phoneCode : null;
    this.phoneCodeSearch = '';
  }

  getFlagUrl(isoCode: string): string {
    return `https://flagcdn.com/w40/${isoCode.toLowerCase()}.png`;
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
}
