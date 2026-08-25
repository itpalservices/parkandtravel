import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveOffcanvas, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { CustomerSortField, CustomersFilterState } from '../../../shared/models/customers.model';
import { PhoneCode } from '../../../shared/models/phone-codes.model';

interface Option {
  id: string;
  label: string;
}

@Component({
  selector: 'app-customers-filter-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbDropdownModule],
  templateUrl: './customers-filter-panel.component.html',
  styleUrls: ['./customers-filter-panel.component.scss'],
})
export class CustomersFilterPanelComponent implements OnInit {
  @Input() state!: CustomersFilterState;
  @Input() phoneCodes: PhoneCode[] = [];

  @Output() apply = new EventEmitter<CustomersFilterState>();
  @Output() reset = new EventEmitter<void>();

  private activeOffcanvas = inject(NgbActiveOffcanvas);

  draft!: CustomersFilterState;
  phoneCodeSearch = '';

  readonly sortFieldOptions: (Option & { id: CustomerSortField })[] = [
    { id: 'name', label: 'Full Name' },
    { id: 'email', label: 'Email' },
    { id: 'phoneCode', label: 'Phone Code' },
    { id: 'phone', label: 'Phone' },
  ];

  ngOnInit(): void {
    this.draft = { ...this.state };
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
