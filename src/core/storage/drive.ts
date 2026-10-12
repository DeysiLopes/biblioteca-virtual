import { UserLibraryData } from '../models/user-data';
import { authService } from '../auth/google-auth';

const FOLDER_NAME = 'Minha Biblioteca';
const SUBFOLDER_NAME = 'Biblioteca';

export class GoogleDriveService {
  private folderId: string | null = null;
  private dataFolderId: string | null = null;
  private fileId: string | null = null;
  private folderPromise: Promise<string> | null = null;
  private dataFolderPromise: Promise<string> | null = null;
  private uploadQueue: Promise<void> = Promise.resolve();

  private getAuthHeader(): Record<string, string> {
    const auth = authService.getAuthState();
    if (!auth.accessToken) {
      throw new Error('Usuário não autenticado.');
    }
    return { Authorization: `Bearer ${auth.accessToken}` };
  }

  /**
   * Obtém ou cria a pasta raiz "Minha Biblioteca" no Google Drive.
   */
  public async getOrCreateFolder(): Promise<string> {
    const auth = authService.getAuthState();
    if (auth.isMock) return 'mock-folder-id';
    if (this.folderId) return this.folderId;

    // Chamadas concorrentes compartilham a mesma promessa — sem duplicar pasta
    this.folderPromise ??= this.findOrCreateFolder(FOLDER_NAME)
      .then((id) => (this.folderId = id))
      .finally(() => (this.folderPromise = null));
    return this.folderPromise;
  }

  /**
   * Pasta de dados: "Biblioteca" dentro de "Minha Biblioteca".
   * Os arquivos de sync ficam nela — Minha Biblioteca/Biblioteca/*.json
   */
  private async getOrCreateDataFolder(): Promise<string> {
    const auth = authService.getAuthState();
    if (auth.isMock) return 'mock-data-folder-id';
    if (this.dataFolderId) return this.dataFolderId;

    this.dataFolderPromise ??= this.getOrCreateFolder()
      .then((rootId) => this.findOrCreateFolder(SUBFOLDER_NAME, rootId))
      .then((id) => (this.dataFolderId = id))
      .finally(() => (this.dataFolderPromise = null));
    return this.dataFolderPromise;
  }

  private async findOrCreateFolder(name: string, parentId?: string): Promise<string> {
    const headers = this.getAuthHeader();
    const parentClause = parentId ? ` and '${parentId}' in parents` : '';
    const query = encodeURIComponent(
      `name = '${name}' and mimeType = 'application/vnd.google-apps.folder'${parentClause} and trashed = false`
    );
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&orderBy=createdTime`,
      { headers }
    );

    if (!searchRes.ok) {
      throw new Error(`Erro ao buscar pasta "${name}" no Drive: ${searchRes.statusText}`);
    }

    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId ? { parents: [parentId] } : {}),
      }),
    });

    if (!createRes.ok) {
      throw new Error(`Erro ao criar pasta "${name}" no Drive: ${createRes.statusText}`);
    }

    const createData = await createRes.json();
    return createData.id;
  }

  /**
   * Procura o arquivo de sync: primeiro na subpasta "Biblioteca",
   * depois na raiz "Minha Biblioteca" (arquivos de versões antigas).
   */
  private async findFile(filename: string): Promise<{ id: string; parentId: string } | null> {
    const headers = this.getAuthHeader();
    const dataFolderId = await this.getOrCreateDataFolder();

    let found: { id: string; parentId: string } | null = null;
    const duplicateIds: string[] = [];

    for (const parentId of [dataFolderId, this.folderId!]) {
      const query = encodeURIComponent(
        `name = '${filename}' and '${parentId}' in parents and trashed = false`
      );
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&orderBy=createdTime`,
        { headers }
      );
      if (!searchRes.ok) {
        if (parentId === dataFolderId) {
          throw new Error(`Erro ao buscar arquivo no Drive: ${searchRes.statusText}`);
        }
        continue;
      }
      const searchData = await searchRes.json();
      for (const f of searchData.files ?? []) {
        if (!found) found = { id: f.id, parentId };
        else duplicateIds.push(f.id);
      }
    }

    // Limpa duplicatas de corridas passadas — fica só o primeiro encontrado
    await Promise.all(
      duplicateIds.map((dupId) =>
        fetch(`https://www.googleapis.com/drive/v3/files/${dupId}`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: '{"trashed":true}',
        }).catch(() => {})
      )
    );
    return found;
  }

  /**
   * Baixa os dados da biblioteca do usuário (`biblioteca-<userId>.json`
   * em Minha Biblioteca/Biblioteca/).
   */
  public async downloadLibrary(userId: string): Promise<UserLibraryData | null> {
    const auth = authService.getAuthState();
    const filename = `biblioteca-${userId}.json`;

    if (auth.isMock) {
      const saved = localStorage.getItem(`mock_drive_${filename}`);
      return saved ? JSON.parse(saved) : null;
    }

    const headers = this.getAuthHeader();
    const found = await this.findFile(filename);
    if (!found) {
      return null;
    }

    this.fileId = found.id;
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
   * Uploads são serializados — concorrentes fazem PATCH em vez de duplicar.
   */
  public async uploadLibrary(userId: string, data: UserLibraryData): Promise<void> {
    const task = this.uploadQueue.then(() => this.doUpload(userId, data));
    this.uploadQueue = task.catch(() => {});
    return task;
  }

  private async doUpload(userId: string, data: UserLibraryData): Promise<void> {
    const auth = authService.getAuthState();
    const filename = `biblioteca-${userId}.json`;
    const jsonContent = JSON.stringify(data, null, 2);

    if (auth.isMock) {
      localStorage.setItem(`mock_drive_${filename}`, jsonContent);
      return;
    }

    const headers = this.getAuthHeader();
    const dataFolderId = await this.getOrCreateDataFolder();

    // Se já temos o fileId ou procuramos (subpasta primeiro, raiz legada depois)
    if (!this.fileId) {
      const found = await this.findFile(filename);
      if (found) {
        this.fileId = found.id;
        // Migra arquivo criado por versões antigas da raiz para a subpasta
        if (found.parentId !== dataFolderId) {
          await fetch(
            `https://www.googleapis.com/drive/v3/files/${this.fileId}?addParents=${dataFolderId}&removeParents=${found.parentId}`,
            { method: 'PATCH', headers }
          );
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
        parents: [dataFolderId],
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
