# فلاش أون - عروض الأسعار

تطبيق ويب عربي (RTL) لعمل عروض أسعار PDF من الموبايل، بيشتغل كتطبيق على الشاشة الرئيسية وبدون نت.
كل البيانات بتتحفظ على الموبايل نفسه (مفيش سيرفر).

## التشغيل على GitHub Pages
1. من الريبو: Settings ← Pages
2. Source: Deploy from a branch
3. Branch: اختار الفرع اللي فيه الملفات (main لو اتدمج) والمجلد `/ (root)` ← Save
4. بعد دقيقة اللينك هيكون: https://mostafasukar33.github.io/factory-tools/

## الملفات
- `index.html` التطبيق كله
- `sw.js` و `manifest.webmanifest` للعمل بدون نت وإضافته للشاشة الرئيسية
- `lib/` مكتبات توليد الـ PDF، `fonts/` خط Cairo، `icons/` اللوجو
