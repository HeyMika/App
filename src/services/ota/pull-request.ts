import { applyHapticFeedback } from '../../utils/haptics'
import OTA_GITHUB_URL, { OTA_UPDATE_ENABLED } from '../../configs/ota.config'
import { Platform, Alert } from 'react-native'

import { githubOTA, OTAUpdateManager } from 'react-native-nitro-ota'
import i18n from '../../i18n'
import navigationRef from '../../screens/navigation'

export const downloadPRUpdate = (prNumber: number) => {
	if (!OTA_UPDATE_ENABLED) {
		Alert.alert(i18n.t('ota.prNotAvailable'))
		return
	}

	const gitBranch = `PULL_REQUEST_${prNumber}_${Platform.OS}`
	const { downloadUrl, versionUrl } = githubOTA({
		githubUrl: OTA_GITHUB_URL,
		otaVersionPath: 'ota.version.json', // JSON manifest, lists differential patches
		ref: gitBranch, // optional, defaults to 'main'
	})
	const otaManager = new OTAUpdateManager(downloadUrl, versionUrl)

	otaManager
		.downloadUpdate()
		.then(() => {
			applyHapticFeedback('success')
			navigationRef.navigate('Ota', { pullRequest: true })
		})
		.catch((error) => {
			applyHapticFeedback('fatal')
			Alert.alert(i18n.t('ota.prNotAvailable'))
		})
}
