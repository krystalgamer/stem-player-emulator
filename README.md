# Stem Player Emulator

This repository contains the source code of Kanye West's stem player.


## Please Read

Kano has been updating their website so the emulator might stop working at any time without warning. If you just want to listen to the album then I suggest you to find mirrors online, if you wish to support the emulator then you can donate [here](https://www.paypal.com/donate/?hosted_button_id=N6QZL2267QYLU). 

Money will be used to buy the stemplayer and teardown for further reverse-engineering purposes.


## Tutorial

If you prefer a video tutorial you can see mine [here](https://www.youtube.com/watch?v=QqBiKZmr5rw)

## Installation (Chrome, Firefox, Safari, Edge, Opera)

1. Install [Tampermonkey](https://www.tampermonkey.net/)
2. Press [here](https://github.com/krystalgamer/stem-player-emulator/raw/master/stem_emulator.user.js), a Tampermonkey tab should open
3. Press install, and you're done

## Mobile Installation (iOS)
1. Install [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887)
1. Open the Userscripts app, and set a directory.
    - Doesn't really matter where, but I would recommend setting it to be on your iPhone and not iCloud
1. Go [here](https://github.com/krystalgamer/stem-player-emulator/raw/master/stem_emulator.user.js)
1. Next to the website name on Safari, click the "aA" button.
1. Click "Manage Extensions" and enable Userscripts
1. Go back to the "aA" menu, and click "Userscripts"
1. Should popup a menu that says "Userscript detected: Install"
1. Click Install, and you're done!


## Working features

- [x] Download on play (when PLAY is pressed, track will be downloaded)
- [x] Removed e-mail requirement
- [x] Download stems from albums
- [x] Download stems from uploaded files
- [x] Download stems from link
- [x] Download WAV stems (true WAV, not the MP3->WAV conversion present on the actual player) - **only works for album tracks**

## Not planned

- [ ] Download full albums (requires storage emulation)
- [ ] Configuration emulation (there's no need)

## License

This project is MIT Licensed