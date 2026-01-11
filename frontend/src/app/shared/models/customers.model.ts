export interface Customer {
  userId: string;
  email: string;
  name: string;
  surname: string;
  phone: string;
  phoneCode: string;
}

export interface PhoneCode {
  id: string;
  isoCode: string;
  phoneCode: string;
}