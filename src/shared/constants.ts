/** 分類対象の最小画像サイズ (px) */
export const MIN_IMAGE_SIZE = 50;

/** LRU キャッシュの最大件数 */
export const CACHE_SIZE = 200;

/** Content Script で画像に付与するデータ属性 */
export const IMAGE_STATUS_ATTR = 'data-image-blocker-status';

/** storage.local のキー */
export const STORAGE_KEY = 'image-blocker-settings';

/** IndexedDB データベース名 */
export const IDB_NAME = 'image-blocker-models';

/** IndexedDB ストア名 */
export const IDB_STORE = 'models';

/** IndexedDB バージョン */
export const IDB_VERSION = 1;
