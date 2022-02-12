import { Component } from 'react'
import { authenticate, userSession } from '../auth';

export default class Main extends Component {
  state: any = {
    userData: null,
  };

  handleSignOut(e: any) {
    e.preventDefault();
    this.setState({ userData: null });
    userSession.signUserOut(window.location.origin);
  }

  render() {
    return (
      <main className="App-main">
        <button onClick={() => authenticate()} disabled={userSession.isUserSignedIn()}>Login</button>
        <div>{this.state.userData ? this.state.userData.username : ''}</div>
        <button onClick={() => {userSession.signUserOut(window.location.origin)}} disabled={!userSession.isUserSignedIn()}>Log out</button>
      </main>
    )
  }

  componentDidMount() {
    if (userSession.isSignInPending()) {
      userSession.handlePendingSignIn().then((userData: any) => {
        window.history.replaceState({}, document.title, '/');
        this.setState({ userData: userData });
      });
    } else if (userSession.isUserSignedIn()) {
      this.setState({ userData: userSession.loadUserData() });
    }
  }
}