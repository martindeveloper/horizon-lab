/** Minimal, strict FITS decoding for the pinned scientific importers (not a general WCS reader). */
import assert from "node:assert/strict";
import { readSync } from "node:fs";

const BLOCK = 2880;
export const paddedFitsSize = (size) => Math.ceil(size / BLOCK) * BLOCK;

/** Strings may contain slashes and doubled apostrophes; comments start outside quotes. */
function cardValue(raw) {
  if (raw.startsWith("'")) {
    const match = /^'((?:[^']|'')*)'/.exec(raw);
    assert(match, "Unterminated FITS string");
    return match[1].replaceAll("''", "'").trimEnd();
  }
  const value = raw.split("/")[0].trim();
  if (value === "T" || value === "F") return value === "T";
  assert(
    /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[ED][+-]?\d+)?$/.test(value),
    `Unsupported FITS value: ${value}`,
  );
  const number = Number(value.replace("D", "E"));
  assert(Number.isFinite(number), "Non-finite FITS header value");
  if (/^[+-]?\d+$/.test(value)) assert(Number.isSafeInteger(number), "Unsafe FITS header integer");
  return number;
}

export function readFitsHeader(buffer, start = 0) {
  const header = {};
  for (let at = start; at + 80 <= buffer.length; at += 80) {
    const card = buffer.toString("ascii", at, at + 80);
    const key = card.slice(0, 8).trim();
    if (key === "END") return { header, offset: paddedFitsSize(at + 80) };
    if (card.slice(8, 10) === "= ") header[key] = cardValue(card.slice(10).trimStart());
  }
  throw new Error("Truncated FITS header (missing END)");
}

export function readExactly(fd, buffer, position, length = buffer.length) {
  let read = 0;
  while (read < length) {
    const count = readSync(fd, buffer, read, length - read, position + read);
    assert(count > 0, "Truncated FITS data");
    read += count;
  }
  return buffer;
}

export function readFitsFileHeader(fd, start = 0) {
  const blocks = [];
  for (let at = start; at < start + 1024 * BLOCK; at += BLOCK) {
    const block = readExactly(fd, Buffer.alloc(BLOCK), at);
    blocks.push(block);
    for (let card = 0; card < BLOCK; card += 80) {
      if (block.toString("ascii", card, card + 8).trim() === "END") {
        const result = readFitsHeader(Buffer.concat(blocks));
        return { header: result.header, offset: start + result.offset };
      }
    }
  }
  throw new Error("FITS header exceeds importer limit");
}

export function fitsColumns(header) {
  assert.equal(header.XTENSION, "BINTABLE");
  const sizes = { L: 1, B: 1, I: 2, J: 4, K: 8, E: 4, D: 8, A: 1 };
  const columns = {};
  let offset = 0;
  for (let i = 1; i <= header.TFIELDS; i++) {
    const match = /^(\d*)([LBIJKEDA])$/.exec(header[`TFORM${i}`]);
    assert(match, `Unsupported FITS column ${header[`TFORM${i}`]}`);
    assert.equal(header[`TSCAL${i}`] ?? 1, 1, "Scaled table column unsupported");
    assert(!header[`TZERO${i}`], "Offset table column unsupported");
    const count = Number(match[1] || 1);
    assert(count > 0);
    const kind = match[2];
    columns[header[`TTYPE${i}`]] = { offset, count, kind, unit: header[`TUNIT${i}`] };
    offset += count * sizes[kind];
  }
  assert.equal(offset, header.NAXIS1, "FITS row size changed");
  return columns;
}

export function fitsValue(row, column) {
  assert(column, "Missing FITS column");
  const { offset, count, kind } = column;
  if (kind === "A") return row.toString("ascii", offset, offset + count).trim();
  assert.equal(count, 1, "Expected a scalar FITS column");
  switch (kind) {
    case "L":
      return row[offset] === 84;
    case "B":
      return row.readUInt8(offset);
    case "I":
      return row.readInt16BE(offset);
    case "J":
      return row.readInt32BE(offset);
    // Catalogue identifiers must never pass through an imprecise JS Number.
    case "K":
      return row.readBigInt64BE(offset);
    case "E":
      return row.readFloatBE(offset);
    case "D":
      return row.readDoubleBE(offset);
    default:
      throw new Error(`Unsupported FITS kind ${kind}`);
  }
}
