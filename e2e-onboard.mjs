import { chromium } from 'playwright';
const S = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERR: ' + e.message.slice(0,120)));
p.on('console', m => { if (m.type()==='error' && !/_vercel/.test(m.text())) errs.push('CONSOLE: '+m.text().slice(0,120)); });

// login
await p.goto('http://localhost:3000/login', { waitUntil: 'load' });
await p.fill('input[type="email"]', 'qa.wave3.tmp@collab47.com');
await p.fill('input[type="password"]', 'QaTest!2026wave3');
await p.click('button[type="submit"]');
await p.waitForTimeout(3500);
console.log('after login url:', p.url());

// should land on onboarding
if (!p.url().includes('onboarding')) { await p.goto('http://localhost:3000/onboarding', { waitUntil:'load' }); await p.waitForTimeout(1500); }
await p.screenshot({ path: `${S}/ob-1-type.png` });

// step 1: choose student
await p.locator('button:has-text("Student")').first().click();
await p.waitForTimeout(1200);
await p.screenshot({ path: `${S}/ob-2-identity.png` });
console.log('step after type:', await p.locator('h1').first().textContent());

// identity: name + handle
const name = p.locator('input#ob-name, input[placeholder*="name" i]').first();
await name.fill('QA Wave Three');
await p.waitForTimeout(300);
const handle = p.locator('input#ob-handle').first();
await handle.fill('qa_wave3_tmp');
await p.waitForTimeout(1400); // availability debounce
await p.screenshot({ path: `${S}/ob-3-handle.png` });
// continue
await p.locator('button:has-text("Continue")').first().click();
await p.waitForTimeout(1200);
console.log('step 3 h1:', await p.locator('h1').first().textContent());
await p.screenshot({ path: `${S}/ob-4-affiliation.png` });

// affiliation: type college
const aff = p.locator('input').first();
await aff.fill('QA Institute of Testing');
await p.waitForTimeout(800);
await p.keyboard.press('Escape'); // dismiss dropdown if any
await p.locator('button:has-text("Continue")').first().click();
await p.waitForTimeout(1200);
console.log('step 4 h1:', await p.locator('h1').first().textContent());
await p.screenshot({ path: `${S}/ob-5-field.png` });

// field: pick first branch chip + year
const chips = p.locator('button[aria-pressed]');
await chips.first().click();
await p.waitForTimeout(400);
// year chips - try clicking a "1st year"/"2nd" style chip
const yearBtn = p.locator('button:has-text("2nd")').first();
if (await yearBtn.count()) await yearBtn.click();
await p.waitForTimeout(400);
await p.screenshot({ path: `${S}/ob-6-field-filled.png` });
const cont = p.locator('button:has-text("Continue")').first();
console.log('continue disabled?', await cont.isDisabled());
await cont.click();
await p.waitForTimeout(1200);
console.log('step 5 h1:', await p.locator('h1').first().textContent());
await p.screenshot({ path: `${S}/ob-7-interests.png` });

// interests: pick 3
const ichips = p.locator('button[aria-pressed="false"]');
for (let i = 0; i < 3; i++) { await ichips.nth(0).click(); await p.waitForTimeout(250); }
await p.waitForTimeout(400);
await p.screenshot({ path: `${S}/ob-8-interests-picked.png` });

// submit
const submit = p.locator('button:has-text("Create my profile"), button[type="submit"]').last();
console.log('submit disabled?', await submit.isDisabled().catch(()=> 'n/a'));
await submit.click();
await p.waitForTimeout(5000);
console.log('FINAL URL:', p.url());
await p.screenshot({ path: `${S}/ob-9-final.png` });
if (errs.length) console.log('ERRORS:\n' + errs.slice(0,6).join('\n'));
await b.close();
