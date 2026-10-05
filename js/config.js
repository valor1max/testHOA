// Edit these values after you deploy the backend (see README.md).
window.HOA_CONFIG = {
  hoaName: 'Maple Ridge Homeowners Association',
  apiBaseUrl: 'https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com',

  // Cognito user pool app client used for board/admin sign-in
  cognito: {
    domain: 'https://YOUR_PREFIX.auth.us-east-1.amazoncognito.com',
    clientId: 'YOUR_APP_CLIENT_ID',
    redirectUri: window.location.origin + '/admin.html',
    logoutUri: window.location.origin + '/',
    scopes: 'openid email',
  },
};
