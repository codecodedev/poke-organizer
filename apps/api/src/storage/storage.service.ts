import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { promises as fs } from 'node:fs';

export abstract class StorageService {
  /**
   * Faz o upload de um arquivo para o provedor de storage.
   * @param path O caminho/nome base do arquivo (ex: id da colecao)
   * @param file O buffer do arquivo
   * @param mimeType O tipo do arquivo (ex: image/jpeg)
   * @returns A URL pública do arquivo enviado
   */
  abstract uploadBanner(path: string, file: Buffer, mimeType: string): Promise<string>;

  /**
   * Remove um arquivo do storage baseado na sua URL.
   * @param url A URL pública do arquivo
   */
  abstract deleteBanner(url: string): Promise<void>;
}

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly logger = new Logger(LocalStorageService.name);

  constructor(private config: ConfigService) {}

  async uploadBanner(path: string, file: Buffer, mimeType: string): Promise<string> {
    const ext = mimeType.split('/')[1] || 'jpeg';
    const filename = `${path}_${randomBytes(4).toString('hex')}.${ext}`;
    
    const dirPath = join(process.cwd(), 'public', 'banners');
    const filePath = join(dirPath, filename);

    // Cria a pasta recursivamente se não existir (evita o erro ENOENT no Docker/local)
    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(filePath, file);

    const baseUrl = this.config.get<string>('API_BASE_URL') ?? 'http://localhost:3333';
    return `${baseUrl}/public/banners/${filename}`;
  }

  async deleteBanner(url: string): Promise<void> {
    try {
      const filename = url.split('/').pop();
      if (!filename) return;

      const filePath = join(process.cwd(), 'public', 'banners', filename);
      await fs.unlink(filePath);
    } catch (error) {
      this.logger.error(`Falha ao excluir arquivo local: ${error.message}`);
    }
  }
}

@Injectable()
export class SupabaseStorageService implements StorageService {
  private readonly supabase: SupabaseClient | null = null;
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly bucket = 'banners';

  constructor(private config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_KEY');
    
    if (url && key) {
      this.supabase = createClient(url, key);
    } else {
      this.logger.warn('Variáveis SUPABASE_URL e/SOU SUPABASE_SERVICE_KEY não encontradas. O upload em produção falhará se não configurado.');
    }
  }

  async uploadBanner(path: string, file: Buffer, mimeType: string): Promise<string> {
    if (!this.supabase) {
      throw new Error('Supabase não está configurado. Verifique as variáveis de ambiente.');
    }

    const ext = mimeType.split('/')[1] || 'jpeg';
    const filename = `${path}_${randomBytes(4).toString('hex')}.${ext}`;
    
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .upload(filename, file, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      this.logger.error(`Falha ao fazer upload para o Supabase: ${error.message}`);
      throw new Error(`Falha no upload da imagem: ${error.message}`);
    }

    const { data: publicUrlData } = this.supabase.storage
      .from(this.bucket)
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  }

  async deleteBanner(url: string): Promise<void> {
    if (!this.supabase) return;

    try {
      const filename = url.split('/').pop();
      if (!filename) return;

      const { error } = await this.supabase.storage
        .from(this.bucket)
        .remove([filename]);

      if (error) {
        this.logger.error(`Falha ao excluir arquivo do Supabase: ${error.message}`);
      }
    } catch (error) {
      this.logger.error(`Erro ao processar exclusão no Supabase: ${error.message}`);
    }
  }
}
