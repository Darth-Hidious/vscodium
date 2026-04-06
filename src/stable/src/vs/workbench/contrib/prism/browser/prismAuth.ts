/*---------------------------------------------------------------------------------------------
 *  Copyright (c) MARC27. All rights reserved.
 *  Licensed under the MARC27 Source-Available License.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IStatusbarService } from '../../../services/statusbar/browser/statusbar.js';

/**
 * Stub — auth status bar is now handled entirely by the prism-auth extension.
 * This workbench contribution is kept as a no-op to avoid breaking the
 * registration in prism.contribution.ts.
 */
export class Marc27AuthenticationProvider extends Disposable {

	constructor(
		@IStatusbarService private readonly _statusbarService: IStatusbarService,
		@ILogService private readonly _logService: ILogService,
	) {
		super();
		this._logService.info('[MARC27] Auth handled by prism-auth extension');
	}
}
