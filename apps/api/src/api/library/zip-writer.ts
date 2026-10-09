/**
 * 极简 ZIP 写出器（仅 STORED，即不压缩）。
 *
 * 作品库里的产物都是 PNG / JPEG / WebP 这类已压缩格式，再压一遍几乎不省体积，
 * 所以直接存盘写入即可，省掉一个 zip 依赖（fflate 只作为间接依赖存在，
 * 不能直接依赖）。
 *
 * 用法：创建实例后对每个文件调用 add()，最后 toEnd() 拿到结尾字节流，
 * 中间用 next() 持续取出已生成的块。
 */

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC32_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** 转成 ZIP 规定的 DOS 日期时间。 */
function toDosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  const dosDate =
    ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const dosTime =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    (Math.floor(date.getSeconds() / 2) & 0x1f);
  return { dosDate: dosDate & 0xffff, dosTime: dosTime & 0xffff };
}

function encodeName(name: string) {
  return Buffer.from(name, "utf8");
}

interface PendingEntry {
  name: string;
  crc: number;
  size: number;
  offset: number;
  dosDate: number;
  dosTime: number;
}

export class ZipWriter {
  private readonly chunks: Buffer[] = [];
  private readonly entries: PendingEntry[] = [];
  private offset = 0;

  /** 写入一个文件（STORE，不压缩）。同名文件会自动追加序号避免互相覆盖。 */
  add(name: string, data: Buffer, modifiedAt?: Date) {
    const entryName = this.resolveUniqueName(name);
    const modified = modifiedAt ?? new Date();
    const { dosDate, dosTime } = toDosDateTime(modified);
    const encodedName = encodeName(entryName);
    const crc = crc32(data);
    const offset = this.offset;

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(0x0800, 6); // UTF-8 文件名
    header.writeUInt16LE(0, 8); // stored
    header.writeUInt16LE(dosTime, 10);
    header.writeUInt16LE(dosDate, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(encodedName.length, 26);
    header.writeUInt16LE(0, 28); // extra length

    this.push(header);
    this.push(encodedName);
    this.push(data);

    this.entries.push({
      name: entryName,
      crc,
      size: data.length,
      offset,
      dosDate,
      dosTime,
    });

    return entryName;
  }

  /** 全部文件写完后调用，返回中央目录 + 结尾记录。 */
  finish() {
    const centralStart = this.offset;

    for (const entry of this.entries) {
      const encodedName = encodeName(entry.name);
      const header = Buffer.alloc(46);
      header.writeUInt32LE(0x02014b50, 0);
      header.writeUInt16LE(20, 4); // version made by
      header.writeUInt16LE(20, 6); // version needed
      header.writeUInt16LE(0x0800, 8); // UTF-8 文件名
      header.writeUInt16LE(0, 10); // stored
      header.writeUInt16LE(entry.dosTime, 12);
      header.writeUInt16LE(entry.dosDate, 14);
      header.writeUInt32LE(entry.crc, 16);
      header.writeUInt32LE(entry.size, 20);
      header.writeUInt32LE(entry.size, 24);
      header.writeUInt16LE(encodedName.length, 28);
      header.writeUInt16LE(0, 30); // extra
      header.writeUInt16LE(0, 32); // comment
      header.writeUInt16LE(0, 34); // disk number
      header.writeUInt16LE(0, 36); // internal attrs
      header.writeUInt32LE(0, 38); // external attrs
      header.writeUInt32LE(entry.offset, 42);

      this.push(header);
      this.push(encodedName);
    }

    const centralSize = this.offset - centralStart;
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4); // disk number
    end.writeUInt16LE(0, 6); // central dir start disk
    end.writeUInt16LE(this.entries.length, 8);
    end.writeUInt16LE(this.entries.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(centralStart, 16);
    end.writeUInt16LE(0, 20); // comment length
    this.push(end);
  }

  /** 取出并清空已缓冲的块。 */
  drain(): Buffer[] {
    if (!this.chunks.length) {
      return [];
    }
    const drained = this.chunks.slice();
    this.chunks.length = 0;
    return drained;
  }

  get fileCount() {
    return this.entries.length;
  }

  private resolveUniqueName(name: string) {
    if (!this.entries.some((entry) => entry.name === name)) {
      return name;
    }
    const dot = name.lastIndexOf(".");
    const base = dot > 0 ? name.slice(0, dot) : name;
    const extension = dot > 0 ? name.slice(dot) : "";
    let suffix = 2;
    let candidate = `${base}-${suffix}${extension}`;
    while (this.entries.some((entry) => entry.name === candidate)) {
      suffix += 1;
      candidate = `${base}-${suffix}${extension}`;
    }
    return candidate;
  }

  private push(buffer: Buffer) {
    this.chunks.push(buffer);
    this.offset += buffer.length;
  }
}
