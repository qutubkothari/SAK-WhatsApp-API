import { AuthenticationState, AuthenticationCreds, SignalDataTypeMap, initAuthCreds } from '@whiskeysockets/baileys';
import { proto } from '@whiskeysockets/baileys';
import db from '../config/database';
import logger from '../utils/logger';

export class DatabaseAuthState {
  private sessionId: string;
  private stateCache: { creds?: AuthenticationCreds } = {};

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  private async getKey(key: string): Promise<any> {
    try {
      const row = await db('auth_state')
        .where({ session_id: this.sessionId, key })
        .first();
      
      if (!row) return null;
      
      const parsed = JSON.parse(row.value);
      
      // Recursively restore Buffers from their JSON representation
      const restoreBuffers = (obj: any): any => {
        if (obj && typeof obj === 'object') {
          if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
            return Buffer.from(obj.data);
          }
          if (Array.isArray(obj)) {
            return obj.map(restoreBuffers);
          }
          const result: any = {};
          for (const k in obj) {
            result[k] = restoreBuffers(obj[k]);
          }
          return result;
        }
        return obj;
      };
      
      return restoreBuffers(parsed);
    } catch (error) {
      logger.error(`DB auth getKey error: sessionId=${this.sessionId} key=${key}`, error);
      return null;
    }
  }

  private async setKey(key: string, value: any): Promise<void> {
    try {
      // JSON.stringify handles Buffers automatically by converting to {type: 'Buffer', data: [...]}
      const valueStr = JSON.stringify(value);
      
      await db('auth_state')
        .insert({
          session_id: this.sessionId,
          key,
          value: valueStr,
          updated_at: db.fn.now()
        })
        .onConflict(['session_id', 'key'])
        .merge({
          value: valueStr,
          updated_at: db.fn.now()
        });
    } catch (error) {
      logger.error(`DB auth setKey error: sessionId=${this.sessionId} key=${key}`, error);
      throw error;
    }
  }

  private async removeKey(key: string): Promise<void> {
    try {
      await db('auth_state')
        .where({ session_id: this.sessionId, key })
        .delete();
    } catch (error) {
      logger.error(`DB auth removeKey error: sessionId=${this.sessionId} key=${key}`, error);
    }
  }

  async getAuthState(): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
    let creds: AuthenticationCreds | null = await this.getKey('creds');
    
    // Initialize new creds if none exist (for new sessions generating QR)
    if (!creds) {
      creds = initAuthCreds();
    }
    
    this.stateCache.creds = creds;

    const self = this;

    return {
      state: {
        creds: this.stateCache.creds as any,
        keys: {
          get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
            const data: { [id: string]: SignalDataTypeMap[T] } = {};
            
            for (const id of ids) {
              const key = `${type}-${id}`;
              const value = await self.getKey(key);
              if (value) {
                data[id] = value as SignalDataTypeMap[T];
              }
            }
            
            return data;
          },
          set: async (data: any) => {
            const promises: Promise<void>[] = [];
            
            for (const category in data) {
              for (const id in data[category]) {
                const key = `${category}-${id}`;
                const value = data[category][id];
                
                if (value === null) {
                  promises.push(self.removeKey(key));
                } else {
                  promises.push(self.setKey(key, value));
                }
              }
            }
            
            await Promise.all(promises);
          }
        }
      },
      saveCreds: async () => {
        if (self.stateCache.creds) {
          await self.setKey('creds', self.stateCache.creds);
        }
      }
    };
  }

  async clearAuthState(): Promise<void> {
    try {
      await db('auth_state')
        .where({ session_id: this.sessionId })
        .delete();
      
      logger.info(`Cleared auth state for session: ${this.sessionId}`);
    } catch (error) {
      logger.error(`Clear auth state error: sessionId=${this.sessionId}`, error);
      throw error;
    }
  }
}
