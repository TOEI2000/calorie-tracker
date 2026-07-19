# CalTrack — ตั้งค่าแจ้งเตือนมื้อเย็นผ่าน n8n (Web Push)

ฝั่งเว็บ (ปุ่ม "เปิดแจ้งเตือน", service worker, ตาราง `push_subscriptions`) พร้อมแล้ว
เหลือฝั่ง n8n ที่ทำหน้าที่ "ยิง push ทุกวันตอนมื้อเย็น" ตามขั้นตอนนี้

## 1. เปิดใช้ web-push ใน n8n (ทำครั้งเดียว)

SSH เข้า VPS แล้วติดตั้ง library และอนุญาตให้ Code node ใช้:

```bash
# ถ้า n8n รันด้วย Docker: เข้า container ก่อน เช่น docker exec -it n8n sh
npm install web-push
```

ตั้ง environment variable ของ n8n แล้ว restart:

```
NODE_FUNCTION_ALLOW_EXTERNAL=web-push
```

## 2. สร้าง workflow ใหม่ (3 nodes)

### Node 1 — Schedule Trigger
- Rule: Every Day, เวลา 19:00
- Timezone ของ workflow: Asia/Bangkok

### Node 2 — HTTP Request (ดึงรายชื่อ subscription)
- Method: GET
- URL: `https://qsrqigptwhwtuyfnpfjy.supabase.co/rest/v1/push_subscriptions?select=endpoint,subscription`
- Headers:
  - `apikey`: **service_role key** (Supabase Dashboard → Settings → API → `service_role` — ห้ามใช้ในฝั่งเว็บเด็ดขาด ใช้ใน n8n เท่านั้น)
  - `Authorization`: `Bearer <service_role key เดียวกัน>`

### Node 3 — Code (ยิง push)

```javascript
const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:peerasin.toey.ignite@gmail.com',
  'BI9SsDtEzaPX71COShICQYOGZf3UwMRb82NIpZGzY1AOysfEhN1WUl-bStypKG-G5N6M-KVN11RsBma3i0PJFyA',
  'wB-EWbhmRU14tPipSARHyEXXBLfEfV4A--wmcFroj8g'
);

const payload = JSON.stringify({
  title: 'CalTrack 🍽️',
  body: 'ถึงเวลาบันทึกมื้อเย็นแล้ว — ถ่ายรูปอาหารได้เลย',
});

const results = [];
for (const item of $input.all()) {
  try {
    await webpush.sendNotification(item.json.subscription, payload);
    results.push({ json: { endpoint: item.json.endpoint, ok: true } });
  } catch (err) {
    // 404/410 = subscription ตายแล้ว (ผู้ใช้ปิดแจ้งเตือน/ลบแอป) — ควรลบทิ้ง
    results.push({ json: { endpoint: item.json.endpoint, ok: false, status: err.statusCode } });
  }
}
return results;
```

(ตัวเลือกเสริม: ต่อ node HTTP Request DELETE ลบแถวที่ `ok: false` ออกจากตาราง)

## 3. ทดสอบ

1. เปิดแอปบนมือถือ (ต้อง Add to Home Screen ก่อนสำหรับ iPhone; Android ใช้ใน Chrome ได้เลย) → login → กด "เปิดแจ้งเตือน" → Allow
2. ใน n8n กด Execute Workflow ด้วยมือ → notification ควรเด้งบนมือถือภายในไม่กี่วินาที
3. เปิด Active ให้ workflow — จากนี้เด้งทุกวัน 19:00

## หมายเหตุ

- VAPID keys คู่นี้ generate ไว้สำหรับโปรเจกต์นี้ (public key เดียวกันฝังอยู่ใน app.js — ถ้าเปลี่ยน key ต้องเปลี่ยนทั้งสองฝั่งและผู้ใช้ต้องกดสมัครใหม่)
- iPhone รองรับ Web Push ตั้งแต่ iOS 16.4 และ**เฉพาะแอปที่ Add to Home Screen แล้วเท่านั้น**
- ผู้ใช้กด "ปิดแจ้งเตือน" ในแอปได้เอง (ลบ subscription ทั้งฝั่งเบราว์เซอร์และฐานข้อมูล)
