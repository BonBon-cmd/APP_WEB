import { FirebaseOptions } from 'firebase/app';

// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  googlePlacesApiKey: 'AIzaSyA-5w4rOAK0DKKhrV8e18S-zmTHcBgqVO0',
  firebase: {
    apiKey: 'AIzaSyDBNCnuL8lXyIxwoo3pgO6dclDutbmORPI',
    authDomain: 'tks-app-bec0c.firebaseapp.com',
    projectId: 'tks-app-bec0c',
    databaseURL: 'https://tks-app-bec0c-default-rtdb.firebaseio.com',
    storageBucket: 'tks-app-bec0c.firebasestorage.app',
    messagingSenderId: '38358063830',
    appId: '1:38358063830:web:f0777fd9ba4cd768284777',
    measurementId: 'G-3YH7MR03D6',
  } as FirebaseOptions,
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
