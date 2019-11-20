import { Component, OnInit, OnDestroy } from '@angular/core';
import { takeUntil } from 'rxjs/operators';
import { LocalDataSource } from 'ng2-smart-table';
import { NbToastrService, NbDialogService } from '@nebular/theme';
import { Proposal } from '@gauzy/models';
import { Store } from '../../@core/services/store.service';
import { Subject } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { ProposalsService } from '../../@core/services/proposals.service';
import { TranslateService } from '@ngx-translate/core';
import { DateViewComponent } from '../../@shared/table-components/date-view/date-view.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { ProposalStatusComponent } from './table-components/proposal-status/proposal-status.component';

export interface ProposalViewModel {
	id: string;
	employeeId?: string;
	organizationId?: string;
	valueDate: Date;
	jobPostUrl?: string;
	jobPostContent?: string;
	proposalContent?: string;
	status?: string;
	author?: string;
}

interface SelectedRowModel {
	data: ProposalViewModel;
	isSelected: boolean;
	selected: ProposalViewModel[];
	source: LocalDataSource;
}

@Component({
	selector: 'ga-proposals',
	templateUrl: './proposals.component.html',
	styleUrls: ['./proposals.component.scss']
})
export class ProposalsComponent implements OnInit, OnDestroy {
	constructor(
		private store: Store,
		private router: Router,
		private proposalsService: ProposalsService,
		private toastrService: NbToastrService,
		private dialogService: NbDialogService,
		private route: ActivatedRoute,
		private translateService: TranslateService
	) {}

	private _ngDestroy$ = new Subject<void>();

	smartTableSettings: object;
	selectedEmployeeId = '';
	selectedDate: Date;

	smartTableSource = new LocalDataSource();

	selectedProposal: SelectedRowModel;
	showTable: boolean;
	employeeName: string;
	loading = true;

	private _selectedOrganizationId: string;

	ngOnInit() {
		this.loadSettingsSmartTable();

		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((org) => {
				if (org) {
					this._selectedOrganizationId = org.id;
				}
			});

		this.store.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employee) => {
				if (employee && employee.id) {
					this.selectedEmployeeId = employee.id;
					this._loadTableData();
				} else {
					if (this._selectedOrganizationId) {
						this.selectedEmployeeId = null;
						this._loadTableData(this._selectedOrganizationId);
					}
				}

				this.loading = false;
			});
	}

	add() {
		this.router.navigate(['/pages/proposals/register']);
	}

	details() {
		this.store.selectedProposal = this.selectedProposal.data;
		this.router.navigate([
			`/pages/proposals/details/${this.selectedProposal.data.id}`
		]);
	}

	delete() {
		this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'Proposal'
				}
			})
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.proposalsService.delete(
							this.selectedProposal.data.id
						);

						this.toastrService.primary(
							'Proposal deleted for successfuly',
							'Success'
						);
						this._loadTableData();
						this.selectedProposal = null;
					} catch (error) {
						this.toastrService.danger(
							error.error.message || error.message,
							'Error'
						);
					}
				}
			});
	}

	changeStatus() {
		// TODO: Implement change status logic
	}

	loadSettingsSmartTable() {
		this.smartTableSettings = {
			actions: false,
			editable: true,
			noDataMessage: 'No data',
			columns: {
				valueDate: {
					title: 'Proposal Registered on',
					type: 'custom',
					width: '20%',
					renderComponent: DateViewComponent,
					filter: false
				},
				jobPostUrl: {
					title: 'View Job Post',
					type: 'html',
					filter: false
				},
				status: {
					title: 'Status',
					type: 'custom',
					width: '10rem',
					class: 'text-center',
					filter: false,
					renderComponent: ProposalStatusComponent
				}
			}
		};

		if (!this.selectedEmployeeId.length) {
			this.smartTableSettings['columns'] = {
				...this.smartTableSettings['columns'],
				author: {
					title: 'Author',
					type: 'string'
				}
			};
		}
	}

	selectProposal(ev: SelectedRowModel) {
		this.selectedProposal = ev;
	}

	private async _loadTableData(orgId?: string) {
		this.showTable = false;
		let items: Proposal[];
		if (this.selectedEmployeeId) {
			const response = await this.proposalsService.getAll(
				['employee', 'organization'],
				{
					employeeId: this.selectedEmployeeId,
					organizationId: this._selectedOrganizationId
				}
			);
			delete this.smartTableSettings['columns']['author'];
			items = response.items;
		} else {
			const response = await this.proposalsService.getAll(
				['organization', 'employee', 'employee.user'],
				{ organizationId: orgId }
			);

			items = response.items;
		}

		try {
			const proposalVM: ProposalViewModel[] = items.map((i) => {
				return {
					id: i.id,
					valueDate: i.valueDate,
					jobPostUrl:
						'<a href="' +
						i.jobPostUrl +
						'" target="_blank">Link to Job Post</a>',
					jobPostContent: i.jobPostContent,
					proposalContent: i.proposalContent,
					status: i.status,
					author: i.employee.user
						? i.employee.user.firstName +
						  ' ' +
						  i.employee.user.lastName
						: ''
				};
			});

			this.smartTableSource.load(proposalVM);
			this.showTable = true;
		} catch (error) {
			this.toastrService.danger(error.message || error.message, 'Error');
		}
	}

	ngOnDestroy() {
		delete this.smartTableSettings['columns']['author'];
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
