import { useRef, useState } from "react";
import { Button } from "tdesign-react";
import { MAX_SCREENSHOTS } from "./constants";
import styles from "./TradeReview.module.css";

type ScreenshotUploadProps = {
  value: string[];
  onChange: (images: string[]) => void;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

function ScreenshotUpload({ value, onChange }: ScreenshotUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  async function appendFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) return;

    const remaining = MAX_SCREENSHOTS - value.length;
    if (remaining <= 0) return;

    const selected = imageFiles.slice(0, remaining);
    const dataUrls = await Promise.all(selected.map(readFileAsDataUrl));
    onChange([...value, ...dataUrls]);
  }

  function handlePaste(event: React.ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length) {
      event.preventDefault();
      void appendFiles(files);
    }
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div onPaste={handlePaste}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitleRow}>
            <span className={styles.cardIcon} aria-hidden>🖼</span>
            <h3 className={styles.cardTitle}>
              交易截图<span className={styles.requiredMark}>*</span>
            </h3>
          </div>
          <p className={styles.cardHint}>首图将作为封面，支持粘贴或拖拽上传</p>
        </div>
        <Button
          theme="primary"
          variant="outline"
          disabled={value.length >= MAX_SCREENSHOTS}
          onClick={() => inputRef.current?.click()}
        >
          + 添加图片
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className={styles.hiddenFileInput}
        onChange={(event) => {
          if (event.target.files) {
            void appendFiles(event.target.files);
          }
          event.target.value = "";
        }}
      />

      {value.length === 0 ? (
        <div
          className={`${styles.screenshotZone} ${isDragging ? styles.screenshotZoneDrag : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              inputRef.current?.click();
            }
          }}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            if (event.dataTransfer.files.length) {
              void appendFiles(event.dataTransfer.files);
            }
          }}
        >
          <div className={styles.screenshotEmptyIcon} aria-hidden>🗂</div>
          <p className={styles.screenshotEmptyText}>暂无截图，点击添加或直接粘贴图片</p>
        </div>
      ) : (
        <div className={styles.screenshotGrid}>
          {value.map((src, index) => (
            <div key={`${src.slice(0, 32)}-${index}`} className={styles.screenshotItem}>
              <img src={src} alt={`交易截图 ${index + 1}`} />
              {index === 0 && <span className={styles.screenshotCoverTag}>封面</span>}
              <button type="button" className={styles.screenshotRemove} aria-label="删除图片" onClick={() => removeAt(index)}>
                ×
              </button>
            </div>
          ))}
          {value.length < MAX_SCREENSHOTS && (
            <button
              type="button"
              className={styles.screenshotZone}
              style={{ minHeight: 120 }}
              onClick={() => inputRef.current?.click()}
            >
              <div className={styles.screenshotEmptyIcon} aria-hidden>+</div>
              <p className={styles.screenshotEmptyText}>继续添加</p>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ScreenshotUpload;
