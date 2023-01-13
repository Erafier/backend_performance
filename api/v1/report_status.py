from json import loads
from flask import request, make_response
from flask_restful import Resource

# from ...models.pd.report import StatusField
from ...models.reports import Report


class API(Resource):
    url_params = [
        '<int:project_id>/<int:report_id>',
    ]

    def __init__(self, module):
        self.module = module

    def get(self, project_id: int, report_id: int):
        project = self.module.context.rpc_manager.call.project_get_or_404(project_id=project_id)
        report = Report.query.filter_by(project_id=project.id, id=report_id).first()
        return {"message": report.test_status["status"]}

    def put(self, project_id: int, report_id: int):
        project = self.module.context.rpc_manager.call.project_get_or_404(project_id=project_id)
        report = Report.query.filter_by(project_id=project.id, id=report_id).first()
        test_status = request.json["test_status"]
        if test_status.get("description") == "Failed update report":
            report.end_time = report.start_time
        report.test_status = test_status
        report.commit()
        return {"message": f"status changed to {report.test_status['status']}"}
