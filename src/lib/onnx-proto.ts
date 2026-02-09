/**
 * ONNX ModelProto の外部データパスを手動 protobuf デコードで抽出する。
 *
 * protobufjs は内部で Function() を使うため Firefox MV3 の CSP でブロックされる。
 *
 * 構造:
 *   ModelProto.graph (field 7, LEN) → GraphProto
 *   GraphProto.initializer (field 5, LEN, repeated) → TensorProto
 *   TensorProto.external_data (field 13, LEN, repeated) → StringStringEntryProto
 *   TensorProto.data_location (field 14, VARINT) → 1 = EXTERNAL
 *   StringStringEntryProto.key (field 1, LEN) → string
 *   StringStringEntryProto.value (field 2, LEN) → string
 */

interface ParseResult {
  hasExternalData: boolean;
  externalDataPath: string | null;
}

const textDecoder = new TextDecoder();

// varint を読み取り、[値, 消費バイト数] を返す
function readVarint(buf: Uint8Array, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buf.length) {
    const b = buf[pos++];
    result |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
  }
  return [result >>> 0, pos - offset];
}

/** LEN-prefixed フィールドの中身をスキップ/取得するために長さを読む */
function readLenPrefixed(buf: Uint8Array, offset: number): { data: Uint8Array; bytesRead: number } {
  const [len, lenBytes] = readVarint(buf, offset);
  return {
    data: buf.subarray(offset + lenBytes, offset + lenBytes + len),
    bytesRead: lenBytes + len,
  };
}

interface StringEntry { key: string; value: string }

/** StringStringEntryProto をデコード */
function decodeStringEntry(buf: Uint8Array): StringEntry {
  let key = '';
  let value = '';
  let pos = 0;
  while (pos < buf.length) {
    const [tag, tagBytes] = readVarint(buf, pos);
    pos += tagBytes;
    const fieldNumber = tag >>> 3;
    const wireType = tag & 0x7;

    if (wireType === 2) { // LEN
      const { data, bytesRead } = readLenPrefixed(buf, pos);
      pos += bytesRead;
      if (fieldNumber === 1) key = textDecoder.decode(data);
      else if (fieldNumber === 2) value = textDecoder.decode(data);
    } else if (wireType === 0) { // VARINT
      const [, vBytes] = readVarint(buf, pos);
      pos += vBytes;
    } else {
      break; // Cannot skip unknown wire type, so stop here
    }
  }
  return { key, value };
}

interface TensorExternalInfo {
  dataLocation: number;
  externalData: StringEntry[];
}

/** TensorProto から data_location と external_data だけ抽出 */
function decodeTensorProto(buf: Uint8Array): TensorExternalInfo {
  let dataLocation = 0;
  const externalData: StringEntry[] = [];
  let pos = 0;

  while (pos < buf.length) {
    const [tag, tagBytes] = readVarint(buf, pos);
    pos += tagBytes;
    const fieldNumber = tag >>> 3;
    const wireType = tag & 0x7;

    if (wireType === 2) { // LEN
      const { data, bytesRead } = readLenPrefixed(buf, pos);
      pos += bytesRead;
      if (fieldNumber === 13) {
        externalData.push(decodeStringEntry(data));
      }
      // Skip other LEN fields
    } else if (wireType === 0) { // VARINT
      const [val, vBytes] = readVarint(buf, pos);
      pos += vBytes;
      if (fieldNumber === 14) dataLocation = val;
    } else if (wireType === 5) { // I32
      pos += 4;
    } else if (wireType === 1) { // I64
      pos += 8;
    } else {
      break;
    }
  }
  return { dataLocation, externalData };
}

/** GraphProto から initializer (field 5) をイテレートし外部データパスを収集 */
function scanGraphForExternalData(buf: Uint8Array): Set<string> {
  const paths = new Set<string>();
  let pos = 0;

  while (pos < buf.length) {
    const [tag, tagBytes] = readVarint(buf, pos);
    pos += tagBytes;
    const fieldNumber = tag >>> 3;
    const wireType = tag & 0x7;

    if (wireType === 2) { // LEN
      const { data, bytesRead } = readLenPrefixed(buf, pos);
      pos += bytesRead;
      if (fieldNumber === 5) {
        // initializer: TensorProto
        const info = decodeTensorProto(data);
        if (info.dataLocation === 1) {
          for (const entry of info.externalData) {
            if (entry.key === 'location' && entry.value) {
              paths.add(entry.value);
            }
          }
        }
      }
    } else if (wireType === 0) { // VARINT
      const [, vBytes] = readVarint(buf, pos);
      pos += vBytes;
    } else if (wireType === 5) { // I32
      pos += 4;
    } else if (wireType === 1) { // I64
      pos += 8;
    } else {
      break;
    }
  }
  return paths;
}

/**
 * ONNX モデルバイナリから外部データの有無とパスを抽出する。
 * protobuf を手動デコードし、TensorProto.data_location == 1 (EXTERNAL) のテンソルから
 * external_data の key="location" を読み取る。
 */
export function parseOnnxExternalData(buffer: ArrayBuffer): ParseResult {
  const buf = new Uint8Array(buffer);
  let pos = 0;

  while (pos < buf.length) {
    const [tag, tagBytes] = readVarint(buf, pos);
    pos += tagBytes;
    const fieldNumber = tag >>> 3;
    const wireType = tag & 0x7;

    if (wireType === 2) { // LEN
      const { data, bytesRead } = readLenPrefixed(buf, pos);
      pos += bytesRead;
      if (fieldNumber === 7) {
        // graph: GraphProto
        const paths = scanGraphForExternalData(data);
        if (paths.size > 0) {
          const [first] = paths;
          return { hasExternalData: true, externalDataPath: first };
        }
        return { hasExternalData: false, externalDataPath: null };
      }
    } else if (wireType === 0) { // VARINT
      const [, vBytes] = readVarint(buf, pos);
      pos += vBytes;
    } else if (wireType === 5) { // I32
      pos += 4;
    } else if (wireType === 1) { // I64
      pos += 8;
    } else {
      break;
    }
  }

  return { hasExternalData: false, externalDataPath: null };
}
