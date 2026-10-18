import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const url = pathToFileURL(resolve('prototypes/smart-tontine-interactif.html')).href;
const out = resolve('artifacts/prototype-qa');
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const scopes = { mobile:20, membre:10, partenaire:8, public:10 };
let visits = 0;
try {
  for (const [scope, count] of Object.entries(scopes)) {
    for (const width of [390,1280]) {
      const page = await browser.newPage({ viewport:{width,height:844} });
      await page.goto(url);
      await page.locator('#scope').selectOption(scope);
      const nav = page.locator('#navigation button');
      assert.equal(await nav.count(), count);
      const names = await nav.allTextContents();
      for (const name of names) {
        await page.getByRole('button',{name,exact:true}).first().click();
        assert.equal(await page.locator('#title').textContent(), name);
        assert.ok(await page.locator('#panels .panel').count() >= 3);
        assert.equal(await page.locator('#navigation button[aria-current="page"]').count(),1);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth+1),false);
        visits++;
      }
      await page.screenshot({path:resolve(out,scope+'-'+width+'.png'),fullPage:true});
      await page.addScriptTag({path:resolve('node_modules/axe-core/axe.min.js')});
      const violations = await page.evaluate(async () => {
        const r = await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});
        return r.violations.map(v=>v.id+': '+v.nodes.length);
      });
      assert.deepEqual(violations,[],scope+' '+width+' accessibility violations');
      await page.close();
    }
  }
  const page = await browser.newPage();
  await page.goto(url);
  await page.getByRole('button',{name:'Continuer'}).click();
  assert.match(await page.locator('#status').innerText(),/Complétez le champ/);
  await page.locator('#demoInput').fill('70000000');
  await page.getByRole('button',{name:'Continuer'}).click();
  assert.match(await page.locator('#status').innerText(),/Aucune opération réelle/);
  await page.getByRole('button',{name:'Écran suivant'}).click();
  assert.equal(await page.locator('#title').textContent(),'Accueil');
  await page.close();
  console.log('PASS: '+visits+' screen/viewport visits, 8 WCAG audits, and interaction tests.');
} finally {
  await browser.close();
}
