export interface Driver {
  userId: string;
  email: string;
  name: string;
  surname: string;
  phone: string;
  phoneCode: string;
  blocked: boolean;
  idNumber?: string;
  address?: string;
}
