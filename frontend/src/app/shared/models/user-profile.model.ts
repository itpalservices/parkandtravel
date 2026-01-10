export interface UserProfile {
  email: string;
  name: string;
  surname: string;
  phone: string;
  phoneCode: string;
  emailVerified: boolean;
  picture?: string;
}

export interface Car {
  id: string;
  userId: string;
  carBrand: string;
  carModel: string;
  carColor: string;
  plateNo: string;
  createdAt: Date;
  updatedAt: Date;
}