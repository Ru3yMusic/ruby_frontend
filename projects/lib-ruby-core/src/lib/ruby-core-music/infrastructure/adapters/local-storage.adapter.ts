import { Injectable } from '@angular/core';
import { StoragePort } from '../../domain/ports/storage.port';

@Injectable({ providedIn: 'root' })
export class LocalStorageAdapter extends StoragePort {
  override get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  override set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // quota exceeded or private mode — ignore
    }
  }

  override remove(key: string): void {
    localStorage.removeItem(key);
  }

  override clear(): void {
    localStorage.clear();
  }
}
