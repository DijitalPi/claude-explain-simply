# claude-explain-simply

Claude Code'un uzun cevaplarının sonuna kısa, jargonsuz bir özet ekleyen eklenti.

Claude detaylı anlatır; detaylı her zaman okunur demek değil — özellikle karşındaki
kişi müşteri, tasarımcı ya da gece 11'deki sen olduğunda. Bu eklenti uzun cevapların
sonuna tek bir şey ekler: her şeyin ne anlama geldiğini ve sıradaki adımı söyleyen
birkaç düz cümle.

Kısa cevaplara dokunmaz.

---

## Nasıl görünüyor

Claude sorunu normal şekilde cevaplar — tablo, kod, hepsi. Sonra:

```
---------

**Basitçe anlatım**

Giriş sayfası bozuk çünkü uygulamanın iki parçası kimin giriş yaptığı konusunda
anlaşamıyor. Bir parça, diğeri çoktan sildikten sonra bile eski "giriş yapıldı"
notuna güvenmeye devam ediyor.

Çözüm, kararı iki yer yerine tek bir yerin vermesi.

Sıradaki adım bende: değişikliği yapıp testleri koşturabilirim.
```

Eklentinin tamamı bu.

---

## Kurulum

```bash
/plugin marketplace add DijitalPi/claude-explain-simply
/plugin install claude-explain-simply@claude-explain-simply
```

Sonra Claude Code'u yeniden başlat. `node` gerekiyor.

---

## Neden skill değil de hook

Benzer bir şey yazacaksan bilmeye değer.

Skill, Claude "bu görev buna uyuyor" dediğinde yüklenir. "Şunu yapmama yardım et"
türü işlerde iyi çalışır. Burada kötü çalışır — çünkü bu kural bir göreve değil,
*her uzun cevaba* bağlı. Claude uzun bir cevap yazmadan önce durup "acaba bir
formatlama skill'i var mı" diye düşünmez; yani bunun skill hali çoğu zaman sessizce
hiçbir şey yapmazdı.

`UserPromptSubmit` hook'unun çalışmak için fark edilmeye ihtiyacı yok.

`/simply` komutu ise diğer yarısı: cevap zaten önünde, sadece insanca hâlini
istiyorsun.

---

## Ayarlar

İsteğe bağlı. Tüm projeler için `~/.claude/explain-simply.json`, tek proje için
proje kökünde `.explain-simply.json`. Proje ayarı üstün gelir.

| Anahtar | Varsayılan | Ne yapar |
| --- | --- | --- |
| `enabled` | `true` | `false` yaparsan kaldırmadan kapanır. Proje bazında işe yarar. |
| `minLines` | `15` | Cevabın kaç satırdan sonra özet alacağı. |
| `heading` | `In simple terms` | Özetin üstündeki kalın başlık. Türkçe için `Basitçe anlatım`. |
| `separator` | `---------` | Özetten önce çizilen çizgi. |
| `summaryLines` | `3-6` | Özetin uzunluğu. |
| `language` | `auto` | `auto` konuşmanın dilini takip eder. Sabitlemek için `"Turkish"`. |
| `avoidTerms` | `[]` | Kendi alanının jargonu. Asıl önemli ayar bu. |
| `refreshEvery` | `8` | Kuralın kaç prompt'ta bir tazeleneceği. `1` = her prompt. |

Türkçe için tipik başlangıç:

```json
{
  "heading": "Basitçe anlatım",
  "language": "auto",
  "avoidTerms": ["EBM", "dönüşüm oranı", "atıf penceresi", "hedefleme"]
}
```

### `avoidTerms` neden önemli

"Jargonsuz" evrensel bir talimat değil — neyin jargon olduğu senin alanına bağlı.
Reklamcı müşteriye yazılan özetle kardiyoloğa yazılan özet tamamen farklı şekillerde
jargonsuzdur. Okuyanın gözünü kaydıran kelimeleri buraya yaz; özet o fikirleri
terimi kullanmadan anlatır.

### Dil notu

Claude'a gönderilen talimat İngilizce, ama bu cevabın İngilizce olmasına yol açmaz;
`language: "auto"` ile özet konuştuğun dilde gelir.

Bilinmesi gereken tek şey: "sade dil" her dilde aynı davranmıyor. Türkçe teknik
konuşma zaten İngilizce kelimelerle karışık ilerliyor ("component'i mount et") —
İngilizce'de jargon sayılan bir kelime Türkçe'de günlük kelime olabilir, tersi de
geçerli. Özetler fazla çevrilmiş ya da yapay geliyorsa, olduğu gibi kalmasını
istediğin kelimeleri `avoidTerms` dışında bırak; sadece gerçekten insan kaybettiren
terimleri listele.

---

## Maliyet

Kural ~200 token. Varsayılan `refreshEvery: 8` ile oturumun ilk prompt'unda, sonra
sekiz prompt'ta bir ekleniyor — tur başına ortalama 25 token civarı.

---

## Bir şey ters giderse

Hook fail-open yazıldı. Bozuk config, yazılamayan temp klasörü, hatalı girdi — her
yol çıktısız `0` ile biter. Prompt'unu engelleyemez, oturumunu bozamaz. Çalışmayı
bırakırsa en kötü ihtimalle özetler sessizce gelmemeye başlar.

Kaldırmadan kapatmak için config'de `"enabled": false`.

Kaldırmak için:

```bash
/plugin uninstall claude-explain-simply@claude-explain-simply
```

---

## Lisans

MIT — [LICENSE](LICENSE).
