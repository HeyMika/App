import React, { useState } from 'react'
import { YStack, XStack, SizableText, ScrollView, Paragraph, Spinner } from 'tamagui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'

import Icon from '../../components/Global/components/icon'
import Button from '../../components/Global/helpers/button'
import SettingsSection from '../../components/Settings/components/settings-section'
import { useClientCertificate } from '../../stores/settings/client-certificate'
import { useJellifyServer } from '../../stores/auth'

/**
 * Extracts the host/port from the current server URL so the system certificate chooser
 * can highlight a certificate previously granted to that server.
 */
function parseHostAndPort(url?: string): { host: string | null; port: number } {
	if (!url) return { host: null, port: 0 }

	try {
		const parsed = new URL(url)
		return { host: parsed.hostname || null, port: parsed.port ? Number(parsed.port) : 0 }
	} catch {
		return { host: null, port: 0 }
	}
}

export default function ClientCertificateScreen(): React.JSX.Element {
	const { bottom } = useSafeAreaInsets()

	const [alias, selectCertificate, clearCertificate, supported] = useClientCertificate()
	const [server] = useJellifyServer()
	const [isBusy, setIsBusy] = useState(false)

	const handleSelect = async () => {
		setIsBusy(true)
		try {
			const { host, port } = parseHostAndPort(server?.url)
			const chosen = await selectCertificate(host, port)

			if (chosen) {
				Toast.show({
					text1: 'Certificate selected',
					text2: chosen,
					type: 'success',
				})
			}
		} catch {
			Toast.show({
				text1: 'Unable to select certificate',
				type: 'error',
			})
		} finally {
			setIsBusy(false)
		}
	}

	const handleRemove = async () => {
		await clearCertificate()
		Toast.show({
			text1: 'Certificate removed',
			type: 'info',
		})
	}

	return (
		<YStack flex={1} backgroundColor='$background' testID='settings-screen-client-certificate'>
			<ScrollView
				contentContainerStyle={{ paddingBottom: Math.max(bottom, 16) + 16 }}
				showsVerticalScrollIndicator={false}
			>
				<SettingsSection
					title='Client Certificate'
					icon='certificate'
					iconColor='$primary'
					defaultExpanded
					collapsible={false}
				>
					<YStack gap='$3'>
						<Paragraph size='$3' color='$borderColor'>
							Some servers require a client certificate (mutual TLS) to connect.
							Choose one from your device and Jellify will present it automatically
							when authenticating.
						</Paragraph>

						{!supported ? (
							<XStack
								alignItems='center'
								gap='$2'
								padding='$3'
								backgroundColor='$backgroundFocus'
								borderRadius='$3'
							>
								<Icon name='information' color='$warning' small />
								<SizableText size='$3' color='$borderColor' flex={1}>
									Client certificates are only supported on Android.
								</SizableText>
							</XStack>
						) : (
							<>
								<XStack
									alignItems='center'
									gap='$3'
									padding='$2'
									backgroundColor='$backgroundFocus'
									borderRadius='$3'
								>
									<YStack
										width={40}
										height={40}
										borderRadius='$2'
										backgroundColor={alias ? '$success' : '$neutral'}
										alignItems='center'
										justifyContent='center'
									>
										<Icon
											name={alias ? 'certificate' : 'certificate-outline'}
											color='$background'
											small
										/>
									</YStack>
									<YStack flex={1}>
										<SizableText size='$4' fontWeight='$6' numberOfLines={1}>
											{alias ?? 'No certificate selected'}
										</SizableText>
										<SizableText size='$2' color='$borderColor'>
											{alias ? 'Selected certificate' : 'None'}
										</SizableText>
									</YStack>
								</XStack>

								<Button
									testID='client-certificate-select-button'
									backgroundColor='$primary'
									disabled={isBusy}
									onPress={handleSelect}
									icon={
										isBusy ? (
											<Spinner color='$background' />
										) : (
											<Icon name='certificate' color='$background' small />
										)
									}
								>
									<Paragraph color='$background' fontWeight='$6'>
										{alias ? 'Change Certificate' : 'Select Certificate'}
									</Paragraph>
								</Button>

								{alias && (
									<Button
										testID='client-certificate-remove-button'
										backgroundColor='$danger'
										disabled={isBusy}
										onPress={handleRemove}
										icon={<Icon name='delete' color='$background' small />}
									>
										<Paragraph color='$background' fontWeight='$6'>
											Remove Certificate
										</Paragraph>
									</Button>
								)}
							</>
						)}
					</YStack>
				</SettingsSection>

				<SettingsSection title='How it works' icon='information' iconColor='$borderColor'>
					<Paragraph size='$3' color='$borderColor'>
						Certificates are managed by Android. Install one via Settings → Security →
						Encryption &amp; credentials → Install a certificate → VPN &amp; app user
						certificate, then select it here. When a server asks for a certificate while
						signing in, you&apos;ll be prompted to choose one automatically.
					</Paragraph>
				</SettingsSection>
			</ScrollView>
		</YStack>
	)
}
