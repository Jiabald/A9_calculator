import { forwardRef, useImperativeHandle, useState } from "react";
import { Button, Image, ImageViewer } from "tdesign-react";
import styles from "./TradeReview.module.css";

export type ScreenshotGalleryHandle = {
  open: (index?: number) => void;
};

type ScreenshotGalleryProps = {
  images: string[];
};

const ScreenshotGallery = forwardRef<ScreenshotGalleryHandle, ScreenshotGalleryProps>(function ScreenshotGallery(
  { images },
  ref
) {
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  function openViewer(index = 0) {
    setViewerIndex(index);
    setViewerVisible(true);
  }

  useImperativeHandle(ref, () => ({
    open: openViewer
  }));

  if (!images.length) return null;

  const [cover, ...rest] = images;

  return (
    <>
      <div className={styles.screenshotSectionHead}>
        <div className="form-section-title" style={{ marginBottom: 0 }}>
          <span className="section-title-text">截图</span>
          <span className="section-title-hint">{images.length} 张</span>
        </div>
        <Button theme="primary" variant="outline" size="small" onClick={() => openViewer(0)}>
          查看大图
        </Button>
      </div>

      <button type="button" className={styles.detailCoverBtn} onClick={() => openViewer(0)}>
        <Image
          className={styles.detailCoverImage}
          src={cover}
          fit="contain"
          shape="round"
          alt="复盘封面"
          overlayContent="点击查看"
          overlayTrigger="hover"
        />
        <span className={styles.detailCoverTag}>封面</span>
      </button>

      {rest.length > 0 && (
        <div className={styles.detailGallery}>
          {rest.map((src, index) => (
            <button
              key={`${src.slice(0, 24)}-${index}`}
              type="button"
              className={styles.detailThumbBtn}
              onClick={() => openViewer(index + 1)}
            >
              <Image
                className={styles.detailThumbImage}
                src={src}
                fit="cover"
                shape="round"
                alt={`截图 ${index + 2}`}
                overlayContent="查看"
                overlayTrigger="hover"
              />
            </button>
          ))}
        </div>
      )}

      <ImageViewer
        visible={viewerVisible}
        images={images}
        index={viewerIndex}
        title={`截图 ${viewerIndex + 1} / ${images.length}`}
        onIndexChange={(index) => setViewerIndex(index)}
        onClose={() => setViewerVisible(false)}
      />
    </>
  );
});

export default ScreenshotGallery;
