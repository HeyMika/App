// Mock for the native ClientCert module (Android client-certificate / mutual TLS).
import { NativeModules } from 'react-native'

NativeModules.ClientCert = {
	isSupported: jest.fn(() => Promise.resolve(true)),
	getSelectedAlias: jest.fn(() => Promise.resolve(null)),
	clearSelectedAlias: jest.fn(() => Promise.resolve()),
	selectCertificate: jest.fn(() => Promise.resolve(null)),
}
