import { UserLibraryData } from '../models/user-data';
import { authService } from '../auth/google-auth';

const FOLDER_NAME = 'Minha Biblioteca';

export class GoogleDriveService {
  private folderId: string | null = null;
  private fileId: string | null = null;

  private getAuthHeader(): Record<string, string> {
    const auth = authService.getAuthState();
    if (!auth.accessToken) {
      throw new Error('Usuário não autenticado.');
    }
    return { Authorization: `Bearer ${auth.accessToken}` };
  }

  /**
   * Obtém ou cria a pasta "Minha Biblioteca" no Google Drive.
   */
  public async getOrCreateFolder(): Promise<string> {
    const auth = authService.getAuthState();
    if (auth.isMock) return 'mock-folder-id';
    if (this.folderId) return this.folderId;

    const headers = this.getAuthHeader();
    const query = encodeURIComponent(
      `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    );
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
      { headers }
    );

    if (!searchRes.ok) {
      throw new Error(`Erro ao buscar pasta no Drive: ${searchRes.statusText}`);
    }

    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      this.folderId = searchData.files[0].id;
      return this.folderId!;
    }

    // Cria a pasta
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (!createRes.ok) {
      throw new Error(`Erro ao criar pasta no Drive: ${createRes.statusText}`);
    }

    const createData = await createRes.json();
    this.folderId = createData.id;
    return this.folderId!;
  }

  /**
   * Baixa os dados da biblioteca do usuário (`biblioteca-<userId>.json`).
   */
  public async downloadLibrary(userId: string): Promise<UserLibraryData | null> {
    const auth = authService.getAuthState();
    const filename = `biblioteca-${userId}.json`;

    if (auth.isMock) {
      const saved = localStorage.getItem(`mock_drive_${filename}`);
      return saved ? JSON.parse(saved) : null;
    }

    const folderId = await this.getOrCreateFolder();
    const headers = this.getAuthHeader();
    const query = encodeURIComponent(
      `name = '${filename}' and '${folderId}' in parents and trashed = false`
    );

    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
      { headers }
    );

    if (!searchRes.ok) {
      throw new Error(`Erro ao buscar arquivo no Drive: ${searchRes.statusText}`);
    }

    const searchData = await searchRes.json();
    if (!searchData.files || searchData.files.length === 0) {
      return null;
    }

    this.fileId = searchData.files[0].id;
    const downloadRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${this.fileId}?alt=media`,
      { headers }
    );

    if (!downloadRes.ok) {
      throw new Error(`Erro ao baixar arquivo do Drive: ${downloadRes.statusText}`);
    }

    const data: UserLibraryData = await downloadRes.json();
    return data;
  }

  /**
   * Faz upload (salva) dos dados da biblioteca no Google Drive.
   */
  public async uploadLibrary(userId: string, data: UserLibraryData): Promise<void> {
    const auth = authService.getAuthState();
    const filename = `biblioteca-${userId}.json`;
    const jsonContent = JSON.stringify(data, null, 2);

    if (auth.isMock) {
      localStorage.setItem(`mock_drive_${filename}`, jsonContent);
      return;
    }

    const folderId = await this.getOrCreateFolder();
    const headers = this.getAuthHeader();

    // Se já temos o fileId ou procuramos
    if (!this.fileId) {
      const query = encodeURIComponent(
        `name = '${filename}' and '${folderId}' in parents and trashed = false`
      );
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
        { headers }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          this.fileId = searchData.files[0].id;
        }
      }
    }

    if (this.fileId) {
      // Atualiza arquivo existente
      const updateRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${this.fileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: jsonContent,
        }
      );
      if (!updateRes.ok) {
        throw new Error(`Erro ao atualizar arquivo no Drive: ${updateRes.statusText}`);
      }
    } else {
      // Cria novo arquivo via multipart
      const metadata = {
        name: filename,
        parents: [folderId],
        mimeType: 'application/json',
      };

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelim = `\r\n--${boundary}--`;

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        jsonContent +
        closeDelim;

      const createRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        }
      );

      if (!createRes.ok) {
        throw new Error(`Erro ao criar arquivo no Drive: ${createRes.statusText}`);
      }

      const createData = await createRes.json();
      this.fileId = createData.id;
    }
  }
}

export const driveService = new GoogleDriveService();
