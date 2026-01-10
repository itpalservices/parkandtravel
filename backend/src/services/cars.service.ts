import { pool } from "../db";

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

export async function getCarsByUserId(userId: string): Promise<Car[]> {
  const result = await pool.query(
    `SELECT id, "userId", "carBrand", "carModel", "carColor", "plateNo", "createdAt", "updatedAt"
     FROM cars 
     WHERE "userId" = $1 
     ORDER BY "createdAt" DESC`,
    [userId]
  );
  return result.rows;
}

export async function getCarById(id: string, userId: string): Promise<Car | null> {
  const result = await pool.query(
    `SELECT id, "userId", "carBrand", "carModel", "carColor", "plateNo", "createdAt", "updatedAt"
     FROM cars 
     WHERE id = $1 AND "userId" = $2`,
    [id, userId]
  );
  return result.rows[0] || null;
}

export async function createCar(
  userId: string,
  carBrand: string,
  carModel: string,
  carColor: string,
  plateNo: string
): Promise<Car> {
  const result = await pool.query(
    `INSERT INTO cars ("userId", "carBrand", "carModel", "carColor", "plateNo")
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, "userId", "carBrand", "carModel", "carColor", "plateNo", "createdAt", "updatedAt"`,
    [userId, carBrand, carModel, carColor, plateNo]
  );
  return result.rows[0];
}

export async function updateCar(
  id: string,
  userId: string,
  carBrand: string,
  carModel: string,
  carColor: string,
  plateNo: string
): Promise<Car | null> {
  const result = await pool.query(
    `UPDATE cars 
     SET "carBrand" = $3, "carModel" = $4, "carColor" = $5, "plateNo" = $6, "updatedAt" = NOW()
     WHERE id = $1 AND "userId" = $2
     RETURNING id, "userId", "carBrand", "carModel", "carColor", "plateNo", "createdAt", "updatedAt"`,
    [id, userId, carBrand, carModel, carColor, plateNo]
  );
  return result.rows[0] || null;
}

export async function deleteCar(id: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM cars WHERE id = $1 AND "userId" = $2`,
    [id, userId]
  );
  return (result.rowCount ?? 0) > 0;
}
