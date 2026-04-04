/*---------------------------------------------------------------------------------------------
 *  Copyright (c) MARC27. All rights reserved.
 *  Licensed under the MARC27 Source-Available License.
 *--------------------------------------------------------------------------------------------*/

import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { Marc27AuthenticationProvider } from './prismAuth.js';

registerWorkbenchContribution2(
	'marc27.authenticationProvider',
	Marc27AuthenticationProvider,
	WorkbenchPhase.AfterRestored
);
