# Launch kit

Texts for announcing Fuga, ready to paste. Replace `[GIF]` with a short
screen recording (10 to 20 seconds: drop a photo, drag a few lines, export,
the camera lining up in Blender). Posts with a moving image get far more
attention than posts with a link alone.

Links used below:

- Website: https://fugaapp.github.io/fuga
- Download: https://fugaapp.github.io/fuga/download.html
- Source: https://github.com/fugaapp/fuga

## The official statement

Use these words whenever someone asks how Fuga was made (bios, About
sections, interviews). The same text is in the app (Help → About Fuga), the
README, the website and the user guide.

> Fuga was designed and directed by Gelain, a motion designer and 3D
> generalist, to find the exact camera behind a photo (its lens, angle and
> position) and bring it into 3D software, so the scene lines up with the
> picture without trial and error. It was written with the help of AI (Claude,
> by Anthropic). Every result is checked by automated tests against cameras
> with known values, and the source is public for anyone to review.

> Fuga foi desenhada e dirigida por Gelain, motion designer e generalista 3D,
> para descobrir a câmara exata por trás de uma fotografia (lente, ângulo e
> posição) e levá-la para o software 3D, de modo que a cena encaixe na imagem
> sem tentativa e erro. Foi escrita com a ajuda de IA (Claude, da Anthropic).
> Cada resultado é verificado por testes automáticos contra câmaras com
> valores conhecidos, e o código é público para quem o quiser rever.

## Before you post

- [ ] Version 0.1.0 is published on GitHub (not a draft), and you installed it
      yourself on at least one machine.
- [ ] You matched one real photo and the camera lined up in Blender.
- [ ] The website is live (Settings → Pages → Source: GitHub Actions) and the
      Download page shows the installers.
- [ ] `[GIF]` recorded.
- [ ] Post on a weekday morning (US Eastern time) for Reddit and Hacker News.
- [ ] Stay around for the first two hours to answer comments. That matters
      more than the text.

Every post says up front that Fuga was built with AI help (Claude). That's
a project decision, not a footnote: the app, the website, the README and
the guide all say the same. If people ask for details, the honest short
version is: "I designed it and decided everything it does; the AI wrote most
of the code; tests check the math against cameras with known values." 

---

## Reddit: r/blender

**Title**

> I made a free, open-source fSpy alternative for camera matching (Blender, Maya, USD)

**Body**

> [GIF]
>
> I do motion design and 3D, and I match cameras to photos all the time. fSpy
> was my go-to for years, but it stopped getting updates, the add-on broke
> with newer Blender versions, and I kept wishing I could use more than two
> lines per vanishing point.
>
> So I made Fuga. Same idea: you drag lines onto edges that are parallel in
> real life, and it works out the focal length, rotation and position of the
> camera. What's different:
>
> - As many lines as you want per vanishing point. Each one makes the result
>   more accurate, and a little meter tells you when your lines disagree.
> - Undo, a proper magnifier that shows your lines while you drag, and Shift
>   for fine movement.
> - Blender export is a plain Python script. Open it in the Text Editor and
>   run it. Nothing to install, so nothing to break when Blender updates.
>   You get the camera, the background image and the render resolution.
> - Also exports to Maya, USD (Houdini, C4D, Unreal) and JSON.
> - Real-world scale if you know one distance in the photo.
>
> It's free and open source (GPL-3.0), runs on Windows, macOS and Linux, and
> doesn't collect any data.
>
> Download: https://fugaapp.github.io/fuga
>
> Full transparency: I'm a designer still learning to program, and I built
> this with a lot of help from AI (Claude). The math is checked by tests against
> cameras with known values, but real photos are the real test, so bug
> reports are very welcome.
>
> It's version 0.1, so I'd love to hear what breaks or what's missing.

---

## Reddit: r/vfx, r/Maya, r/Houdini

**Title**

> Fuga: free single-image camera matching that exports to Maya, USD and Blender

**Body**

> [GIF]
>
> Fuga solves a camera from vanishing points in a single photo: trace parallel
> edges, get focal length, rotation, position and (with 3 VPs) the principal
> point for cropped or shifted images. It's in the spirit of fSpy, rebuilt
> with least-squares fitting over any number of lines per vanishing point.
>
> Exports write full world matrices rather than Euler angles. Maya gets a
> Python script (film back, film offset, image plane). USD gets a Y-up
> `.usda` camera. JSON has the K matrix and both Z-up and Y-up transforms.
>
> Free, GPL-3.0, Windows/macOS/Linux, no telemetry. I'm a motion designer,
> not a developer: I designed it and wrote it with heavy help from AI
> (Claude), and the solver is covered by tests against known cameras.
>
> https://fugaapp.github.io/fuga
>
> First release, so feedback from people who do this daily is exactly what I
> need.

---

## Blender Artists

Forum: *Blender and CG Discussions* (or reply in the old fSpy announcement
thread, where many fSpy users still are).

**Title**

> Fuga: free, open-source camera matching from a single photo (fSpy-style, exports to Blender 5.1)

**Body**

> Hi everyone,
>
> [GIF]
>
> I've been using fSpy for years and got tired of the add-on breaking with
> every big Blender release, so I built a successor of sorts. It's called
> Fuga ("ponto de fuga" is Portuguese for vanishing point).
>
> How it works will feel familiar: open a photo, drag the coloured lines onto
> parallel edges, set the origin, export. The Blender export is a standalone
> script: open it in the Text Editor and press Run Script. It creates the
> camera with the right lens, sensor and shift, sets the photo as the camera
> background and matches the render resolution. No add-on to install.
>
> Things I added because I missed them in fSpy:
>
> - Unlimited lines per vanishing point, with a quality meter
> - Undo and redo
> - A magnifier that shows your lines, and Shift for precise dragging
> - Reference distance for real-world scale
> - Exports for Maya, USD and JSON too
> - Light and dark themes
>
> It's free and open source (GPL-3.0) and works on Windows, macOS and Linux.
> There's an illustrated PDF guide on the website.
>
> https://fugaapp.github.io/fuga
>
> One thing I want to be upfront about: I'm a motion designer, not a
> programmer. I designed Fuga and made every decision about how it works and
> looks, and I wrote it with a lot of help from AI (Claude). The math is
> checked by automated tests and the code is public, so anyone can look.
>
> Huge thanks to Per Gantelius for fSpy. Fuga wouldn't exist without it.
>
> This is 0.1, so please tell me what goes wrong. Issues go here:
> https://github.com/fugaapp/fuga/issues

---

## Hacker News: Show HN

**Title**

> Show HN: Fuga – camera calibration from a single photo, exported to Blender/Maya/USD

**Text**

> Fuga takes a photo, lets you trace edges that are parallel in the real
> world, and recovers the camera: focal length, rotation, position and, with
> three vanishing points, the principal point. It's aimed at 3D artists who
> need to place objects into photos, and it's a successor to fSpy, which is
> no longer maintained.
>
> Some details that might interest people here:
>
> - Vanishing points are fitted by least squares over any number of segments,
>   then reweighted so the cost approximates angular click error. On
>   synthetic data with 0.7 px endpoint noise, ten lines per point cut the
>   focal-length error by at least 30% compared with two.
> - Tests build cameras with known parameters, project a box, and check the
>   solver recovers them to ~1e-9. Exporters are round-trip tested by
>   re-projecting through each target's camera model; the USD output was also
>   checked against Pixar's own library.
> - Electron app with the network locked down in code: the only request it
>   makes is an optional check for new releases on GitHub.
>
> TypeScript, GPL-3.0. I'm a motion designer, not a software engineer; I
> built it with heavy help from Claude and leaned on tests to keep it honest.
>
> https://github.com/fugaapp/fuga

---

## BlenderNation, CG Channel, 80.lv (news tip)

**Subject**

> Free open-source camera matching tool: Fuga 0.1 (fSpy successor)

**Message**

> Hello,
>
> I'm Gelain, a motion designer and 3D generalist. I've just released Fuga, a
> free, open-source app for matching a 3D camera to a single photo, in the
> spirit of fSpy (which is no longer updated).
>
> You trace edges that are parallel in the real world and Fuga solves the
> camera's focal length, rotation and position. It exports a ready-to-run
> script for Blender 5.1 (camera, background image and resolution set up, no
> add-on needed), a Python script for Maya, a USD camera for Houdini, Cinema
> 4D and Unreal, and JSON.
>
> Differences from fSpy: any number of lines per vanishing point with a
> quality meter, undo, a magnifier that shows the lines, real-world scale,
> and light and dark themes. It runs on Windows, macOS and Linux and collects
> no data.
>
> In the interest of transparency: I designed Fuga and built it with the
> help of AI (Claude). Every result is checked by automated tests and the
> source is public.
>
> Website and download: https://fugaapp.github.io/fuga
> Source (GPL-3.0): https://github.com/fugaapp/fuga
> A short demo: [GIF or video link]
> Images for the article: brand/social-preview.png and
> docs/guide/shots/main-dark.png in the repository.
>
> Thanks for reading,
> Gelain

---

## AlternativeTo

List Fuga as an alternative to **fSpy**.

**Name:** Fuga
**Short description (max ~150 chars):**

> Free, open-source camera matching from a single photo. Trace edges, get the camera, export to Blender, Maya or USD.

**Description:**

> Fuga finds the camera that took a photo. Drag lines onto edges that are
> parallel in real life and it calculates the focal length, angle and
> position, then exports a camera for Blender, Maya or any app that reads
> USD. It supports one, two or three vanishing points, unlimited lines per
> point, real-world scale from a known distance, undo and a pixel magnifier.
> Free and open source (GPL-3.0), for Windows, macOS and Linux, with no
> account and no tracking. Designed by a motion designer and built with AI
> assistance (Claude); the math is covered by automated tests.

**Tags:** camera matching, camera calibration, vanishing points, Blender,
Maya, USD, photogrammetry, 3D

---

## Short posts (X, Bluesky, Mastodon, Threads)

> Made a free camera-matching app for 3D artists. Drag lines on a photo, get
> the camera, drop it into Blender or Maya. Open source, Win/Mac/Linux, built
> with AI help (Claude).
> https://fugaapp.github.io/fuga
> [GIF]

> fSpy fans: I built a successor. More lines per vanishing point, undo, a real
> magnifier, and a Blender export that doesn't need an add-on.
> https://fugaapp.github.io/fuga

## Instagram / ArtStation caption (English)

> I made a tool. 🫡
>
> Fuga matches a 3D camera to any photo. Trace a few edges, export, and your
> render lines up with the picture. It's free and open source, for Blender,
> Maya and anything that reads USD.
>
> Designed by me, built with AI help (Claude), tested against the math.
>
> Link in bio · fugaapp.github.io/fuga
>
> #blender3d #b3d #motiondesign #3dart #vfx #cameramatching #opensource

---

## Português: LinkedIn

> Lancei hoje a Fuga, uma ferramenta gratuita e open source para quem trabalha
> com 3D.
>
> Quem faz motion ou visualização conhece o problema: tens uma fotografia e
> precisas de uma câmara 3D que veja exatamente o mesmo, para colocar um
> objeto, um produto ou um edifício lá dentro. Durante anos usei o fSpy para
> isto, mas deixou de ser atualizado e o add-on para o Blender começou a
> partir a cada versão nova.
>
> A Fuga faz o mesmo trabalho com mais rigor: traças algumas linhas paralelas
> na foto, ela calcula a lente, o ângulo e a posição da câmara, e exporta para
> Blender, Maya ou qualquer programa que leia USD (Houdini, Cinema 4D,
> Unreal).
>
> Como designer que está a aprender a programar, este projeto foi uma escola
> enorme. Construí-o com muita ajuda de IA e com testes a confirmar cada
> cálculo. Está disponível para Windows, macOS e Linux, não recolhe dados e o
> código é público.
>
> Se trabalhas com 3D, experimenta e diz-me o que falta:
> https://fugaapp.github.io/fuga
>
> #3D #MotionDesign #Blender #OpenSource #VFX

## Português: Instagram

> Fiz uma ferramenta e é de graça. 🫡
>
> A Fuga encaixa uma câmara 3D em qualquer fotografia: traças umas linhas, ela
> descobre a lente e o ângulo, e o teu render bate certo com a foto. Funciona
> com Blender, Maya e tudo o que leia USD.
>
> Open source, sem conta e sem anúncios. Desenhei-a eu e construí-a com a
> ajuda de IA (Claude), com testes a confirmar cada cálculo. Link na bio.
>
> #blender3d #motiondesign #3dbrasil #3dportugal #vfx #opensource
