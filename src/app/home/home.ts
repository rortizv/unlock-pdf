import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import {
  formatBytes,
  isEncryptedPdf,
  isPdfBytes,
  isWrongPassword,
  looksLikePdfFile,
  renderFirstPage,
  unlockPdf,
  wait,
} from './pdf';

type Stage = 'drop' | 'password' | 'ready';
type NoticeKind = 'ok' | 'warn' | 'error' | 'info';

interface Notice {
  kind: NoticeKind;
  title: string;
  body: string;
}

@Component({
  imports: [],
  selector: 'app-home',
  styleUrl: './home.css',
  templateUrl: './home.html',
})
export class Home {
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private readonly passwordField = viewChild<ElementRef<HTMLInputElement>>('passwordField');
  private readonly previewCanvas = viewChild<ElementRef<HTMLCanvasElement>>('previewCanvas');

  protected readonly stage = signal<Stage>('drop');
  protected readonly dragOver = signal(false);
  protected readonly checking = signal(false);
  protected readonly unlocking = signal(false);
  protected readonly shakePassword = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly previewReady = signal(false);
  protected readonly notice = signal<Notice | null>(null);

  protected readonly fileName = signal('');
  protected readonly fileSize = signal('');
  protected readonly password = signal('');
  protected readonly pageCount = signal(0);
  protected readonly unlockedName = signal('');
  protected readonly unlockedSize = signal('');
  protected readonly unlockedUrl = signal<string | null>(null);

  private sourceBytes: Uint8Array | null = null;
  private dragDepth = 0;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.revokeUnlockedUrl();
      if (this.noticeTimer) {
        clearTimeout(this.noticeTimer);
      }
    });
  }

  protected openPicker(): void {
    this.fileInput()?.nativeElement.click();
  }

  protected onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      void this.takeFile(file);
    }
  }

  protected onDragEnter(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth += 1;
    this.dragOver.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) {
      this.dragOver.set(false);
    }
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth = 0;
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      void this.takeFile(file);
    }
  }

  protected onPasswordInput(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
    this.shakePassword.set(false);
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected reset(message?: Notice): void {
    this.stage.set('drop');
    this.checking.set(false);
    this.unlocking.set(false);
    this.shakePassword.set(false);
    this.showPassword.set(false);
    this.previewReady.set(false);
    this.password.set('');
    this.fileName.set('');
    this.fileSize.set('');
    this.pageCount.set(0);
    this.unlockedName.set('');
    this.unlockedSize.set('');
    this.sourceBytes = null;
    this.revokeUnlockedUrl();
    if (message) {
      this.flash(message);
    } else {
      this.notice.set(null);
    }
  }

  protected async unlock(): Promise<void> {
    const bytes = this.sourceBytes;
    const secret = this.password().trim();
    if (!bytes) {
      this.reset({
        kind: 'error',
        title: 'No hay archivo',
        body: 'Vuelve a elegir el PDF protegido.',
      });
      return;
    }
    if (!secret) {
      this.shakePassword.set(false);
      requestAnimationFrame(() => this.shakePassword.set(true));
      this.flash({
        kind: 'warn',
        title: 'Falta la contraseña',
        body: 'Escríbela para poder quitar el bloqueo.',
      });
      this.passwordField()?.nativeElement.focus();
      return;
    }

    this.unlocking.set(true);
    this.flash({
      kind: 'info',
      title: 'Desbloqueando',
      body: 'Descifrando el PDF en tu navegador…',
    });

    try {
      const [unlocked] = await Promise.all([unlockPdf(bytes, secret), wait(900)]);
      const name = this.unlockedFileName(this.fileName());
      this.unlockedName.set(name);
      this.unlockedSize.set(formatBytes(unlocked.byteLength));
      this.replaceUnlockedUrl(unlocked);
      this.stage.set('ready');
      this.unlocking.set(false);
      this.flash({
        kind: 'ok',
        title: 'PDF libre',
        body: 'Ya no pide contraseña. Revisa el preview y descárgalo.',
      });
      afterNextRender(
        () => {
          void this.paintPreview(unlocked);
        },
        { injector: this.injector },
      );
    } catch (error) {
      this.unlocking.set(false);
      this.shakePassword.set(false);
      requestAnimationFrame(() => this.shakePassword.set(true));
      if (isWrongPassword(error)) {
        this.flash({
          kind: 'error',
          title: 'Contraseña incorrecta',
          body: 'Esa clave no abre este PDF. Prueba otra.',
        });
        this.passwordField()?.nativeElement.select();
        return;
      }
      this.flash({
        kind: 'error',
        title: 'No se pudo desbloquear',
        body: error instanceof Error ? error.message : 'El PDF usa un cifrado que no pude leer.',
      });
    }
  }

  protected download(): void {
    const url = this.unlockedUrl();
    if (!url) {
      return;
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = this.unlockedName() || 'unlocked.pdf';
    link.click();
  }

  private async takeFile(file: File): Promise<void> {
    this.checking.set(true);
    this.stage.set('drop');
    this.previewReady.set(false);
    this.password.set('');
    this.flash({
      kind: 'info',
      title: 'Revisando archivo',
      body: 'Comprobando que sea un PDF y que esté bloqueado…',
    });

    try {
      const [buffer] = await Promise.all([file.arrayBuffer(), wait(650)]);
      const bytes = new Uint8Array(buffer);

      if (!isPdfBytes(bytes)) {
        this.checking.set(false);
        this.flash({
          kind: 'error',
          title: 'Eso no es un PDF',
          body: looksLikePdfFile(file)
            ? 'El archivo se llama PDF, pero la cabecera no es de un PDF real.'
            : 'Elige un archivo .pdf. Lo compruebo por la cabecera del documento.',
        });
        return;
      }

      const locked = await isEncryptedPdf(bytes);
      if (!locked) {
        this.checking.set(false);
        this.flash({
          kind: 'warn',
          title: 'Este PDF ya está libre',
          body: 'No tiene contraseña. Solo acepto PDFs bloqueados.',
        });
        return;
      }

      this.sourceBytes = bytes;
      this.fileName.set(file.name);
      this.fileSize.set(formatBytes(file.size));
      this.checking.set(false);
      this.stage.set('password');
      this.flash({
        kind: 'ok',
        title: 'PDF bloqueado',
        body: 'Está protegido. Escribe la contraseña para devolverlo libre.',
      });
      afterNextRender(
        () => {
          this.passwordField()?.nativeElement.focus();
        },
        { injector: this.injector },
      );
    } catch (error) {
      this.checking.set(false);
      this.flash({
        kind: 'error',
        title: 'No pude leer el archivo',
        body: error instanceof Error ? error.message : 'Intenta con otro PDF.',
      });
    }
  }

  private async paintPreview(bytes: Uint8Array): Promise<void> {
    const canvas = this.previewCanvas()?.nativeElement;
    if (!canvas) {
      return;
    }
    try {
      const pages = await renderFirstPage(bytes, canvas);
      this.pageCount.set(pages);
      this.previewReady.set(true);
    } catch {
      this.previewReady.set(true);
      this.flash({
        kind: 'warn',
        title: 'Preview limitado',
        body: 'El archivo está desbloqueado, pero no pude dibujar la primera página. Descárgalo igual.',
      });
    }
  }

  private unlockedFileName(original: string): string {
    const trimmed = original.replace(/\.pdf$/i, '');
    return `${trimmed || 'documento'}-unlocked.pdf`;
  }

  private flash(notice: Notice): void {
    this.notice.set(null);
    requestAnimationFrame(() => this.notice.set(notice));
    if (this.noticeTimer) {
      clearTimeout(this.noticeTimer);
    }
    this.noticeTimer = setTimeout(() => {
      if (this.notice() === notice) {
        this.notice.set(null);
      }
    }, 5200);
  }

  private replaceUnlockedUrl(bytes: Uint8Array): void {
    this.revokeUnlockedUrl();
    const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    this.unlockedUrl.set(URL.createObjectURL(blob));
  }

  private revokeUnlockedUrl(): void {
    const url = this.unlockedUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.unlockedUrl.set(null);
  }
}
