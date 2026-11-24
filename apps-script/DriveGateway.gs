/**
 * Drive Gateway — ประตูเชื่อมระหว่างแอปบน Vercel กับ Google Drive ของเจ้าของระบบ
 * ==================================================================
 * แอปใหม่ (Vercel + Supabase) เก็บข้อมูลทั้งหมดใน Supabase แต่ไฟล์ยังอยู่ใน Google Drive
 * สคริปต์นี้ทำงานในนามบัญชี Google เจ้าของ Drive และทำได้แค่ 5 อย่าง:
 *   ensureFolder        หา/สร้างโฟลเดอร์ของชิ้นงาน + หมวด (ชื่อโฟลเดอร์เหมือนระบบเดิม)
 *   createUploadSession เปิด "ช่องอัปโหลด" ให้เบราว์เซอร์ส่งไฟล์ตรงเข้า Drive (ไม่ผ่าน Vercel)
 *   getFile             อ่านข้อมูลไฟล์ (ใช้ยืนยันว่าอัปโหลดเข้าโฟลเดอร์ที่ถูกต้องจริง)
 *   trash               ย้ายไฟล์ลงถังขยะ
 *   storage             พื้นที่ Drive ที่ใช้ไป
 *
 * ทุกคำขอต้องมี "secret" ตรงกับ Script Property ชื่อ GATEWAY_SECRET
 * (ตั้งค่าที่ Project Settings → Script Properties) ค่าเดียวกันต้องใส่ใน Vercel
 * เป็นตัวแปร DRIVE_GATEWAY_SECRET — ถ้าไม่ได้ตั้ง GATEWAY_SECRET สคริปต์จะปฏิเสธทุกคำขอ
 *
 * Deploy: Deploy → New deployment → Web app
 *   Execute as: Me    Who has access: Anyone
 * แล้วนำ URL ที่ได้ (ลงท้ายด้วย /exec) ไปใส่ใน Vercel เป็น DRIVE_GATEWAY_URL
 */

var ROOT_FOLDER_NAME = 'ระบบจัดเก็บเอกสารชิ้นงาน';
var TEST_PREFIX = '[ใบบันทึกผลการทดสอบ] ';
var TEST_CATEGORY_NAME = 'ใบบันทึกผลการทดสอบ';
var CATEGORIES = {
  1: 'ใบรับรองความต้องการ', 2: 'Sketch Design', 3: '3D Drawing', 4: '2D Drawing',
  5: 'ใบบันทึกผลการตรวจสอบเบื้องต้น', 6: 'ใบขอทดสอบแม่พิมพ์',
  7: 'ใบบันทึกผลตรวจสอบและรับรองผลิตภัณฑ์', 8: 'ใบบันทึกผลการทดสอบ', 9: 'ใบมาตรฐานสินค้าและผลิตภัณฑ์'
};
var MAX_FILE_BYTES = 10 * 1024 * 1024;

function doGet() {
  return json_({ ok: true, service: 'drive-gateway' });
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'bad_json' });
  }
  var secret = PropertiesService.getScriptProperties().getProperty('GATEWAY_SECRET');
  if (!secret || secret.length < 24 || !safeEqual_(String(req.secret || ''), secret)) {
    return json_({ ok: false, error: 'unauthorized' });
  }
  try {
    switch (req.action) {
      case 'ensureFolder':        return json_(ensureFolder_(req));
      case 'createUploadSession': return json_(createUploadSession_(req));
      case 'getFile':             return json_(getFile_(req));
      case 'trash':               return json_(trash_(req));
      case 'storage':             return json_(storage_());
      default:                    return json_({ ok: false, error: 'unknown_action' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

// ---------- actions ----------

function ensureFolder_(req) {
  var system = req.system === 'test' ? 'test' : 'main';
  var partCode = String(req.partCode || '').trim();
  if (!partCode || partCode.length > 100) throw new Error('bad_part_code');
  var catNo = Number(req.categoryNo);
  var catFolderName;
  if (system === 'test') {
    catFolderName = '1. ' + TEST_CATEGORY_NAME;
  } else {
    if (!CATEGORIES[catNo]) throw new Error('bad_category');
    catFolderName = catNo + '. ' + CATEGORIES[catNo];
  }
  // lock กันสร้างโฟลเดอร์ชื่อซ้ำเมื่อมีคนอัปโหลดชิ้นงานเดียวกันพร้อมกัน
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var root = getOrCreate_(DriveApp.getRootFolder(), ROOT_FOLDER_NAME);
    var part = getOrCreate_(root, (system === 'test' ? TEST_PREFIX : '') + partCode);
    var cat = getOrCreate_(part, catFolderName);
    return { ok: true, folderId: cat.getId() };
  } finally {
    lock.releaseLock();
  }
}

// เปิด resumable upload session ของ Drive API แล้วคืน URL ของ session ให้แอป
// แอปบน Vercel จะส่งไฟล์เข้า URL นี้เป็นชิ้นๆ (URL นี้ใช้อัปโหลดได้ไฟล์เดียว ในโฟลเดอร์ที่กำหนด
// และหมดอายุเองภายใน 1 สัปดาห์ — แอปเก็บไว้ฝั่งเซิร์ฟเวอร์เท่านั้น ไม่ส่งให้เบราว์เซอร์)
function createUploadSession_(req) {
  var folderId = String(req.folderId || '');
  var name = String(req.fileName || 'untitled').substring(0, 300);
  var mime = String(req.mimeType || 'application/octet-stream').substring(0, 150);
  var size = Number(req.size);
  if (!/^[A-Za-z0-9_-]{10,}$/.test(folderId)) throw new Error('bad_folder');
  if (!(size > 0 && size <= MAX_FILE_BYTES)) throw new Error('bad_size');
  var res = UrlFetchApp.fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,parents',
    {
      method: 'post',
      contentType: 'application/json; charset=UTF-8',
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
        'X-Upload-Content-Type': mime,
        'X-Upload-Content-Length': String(size)
      },
      payload: JSON.stringify({ name: name, parents: [folderId], mimeType: mime }),
      muteHttpExceptions: true
    });
  if (res.getResponseCode() !== 200) throw new Error('drive_session_failed_' + res.getResponseCode());
  var headers = res.getAllHeaders();
  var location = headers.Location || headers.location;
  if (!location) throw new Error('drive_no_location');
  return { ok: true, uploadUrl: location };
}

function getFile_(req) {
  var id = String(req.fileId || '');
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) throw new Error('bad_file_id');
  var f = DriveApp.getFileById(id);
  var parents = [];
  var it = f.getParents();
  while (it.hasNext()) parents.push(it.next().getId());
  return {
    ok: true,
    file: { id: f.getId(), name: f.getName(), size: f.getSize(), mimeType: f.getMimeType(),
            url: f.getUrl(), parents: parents, trashed: f.isTrashed() }
  };
}

function trash_(req) {
  var id = String(req.fileId || '');
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) throw new Error('bad_file_id');
  try {
    DriveApp.getFileById(id).setTrashed(true);
  } catch (err) {
    return { ok: true, missing: true }; // ไฟล์ถูกลบไปแล้ว/ไม่พบ — ถือว่าสำเร็จ
  }
  return { ok: true };
}

function storage_() {
  var limit = Number(DriveApp.getStorageLimit()) || 0;
  var used = Number(DriveApp.getStorageUsed()) || 0;
  return { ok: true, limit: limit, used: used };
}

// ---------- helpers ----------

function getOrCreate_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// รันครั้งเดียวจาก editor เพื่อสร้าง secret แบบสุ่ม (ดูค่าใน Execution log แล้วคัดลอกไปใส่ Vercel)
function generateSecret() {
  var s = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('GATEWAY_SECRET', s);
  console.log('GATEWAY_SECRET = ' + s);
}
