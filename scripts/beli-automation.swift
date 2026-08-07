import AppKit
import ApplicationServices
import CoreGraphics
import Foundation
import ImageIO
import ScreenCaptureKit
import Vision

private struct AutomationConfiguration: Decodable {
    let sessionId: String
    let restaurantName: String
    let address: String
    let rating: String
    let category: String
    let description: String
    let visitDate: String
    let photoPaths: [String]
    let photoDescriptions: [String]?
    let debugDirectory: String?
}

private struct OCRItem: Encodable {
    let text: String
    let confidence: Float
    let x: Double
    let y: Double
    let width: Double
    let height: Double

    var center: CGPoint {
        CGPoint(x: x + width / 2, y: y + height / 2)
    }
}

private enum AutomationFailure: LocalizedError {
    case message(String)
    case photosNotFound

    var errorDescription: String? {
        switch self {
        case .message(let message): message
        case .photosNotFound: "Not every meal photo could be matched in the Beli album."
        }
    }

    var recoveryCode: String? {
        switch self {
        case .message: nil
        case .photosNotFound: "photos_not_found"
        }
    }
}

private final class PhoneScreenshot {
    let window: SCWindow
    private var hasCapturedImage = false

    init() async throws {
        let content = try await SCShareableContent.excludingDesktopWindows(
            false,
            onScreenWindowsOnly: true
        )
        guard let phoneWindow = content.windows.first(where: { window in
            let appName = window.owningApplication?.applicationName.lowercased() ?? ""
            return appName.contains("iphone mirroring")
        }) else {
            throw AutomationFailure.message("iPhone Mirroring is not open.")
        }
        window = phoneWindow
    }

    func image() async throws -> CGImage {
        if hasCapturedImage {
            try await Task.sleep(
                nanoseconds: UInt64.random(in: 0...200_000_000)
            )
        }
        let scale = NSScreen.main?.backingScaleFactor ?? 2
        let configuration = SCStreamConfiguration()
        configuration.width = max(1, Int(window.frame.width * scale))
        configuration.height = max(1, Int(window.frame.height * scale))
        configuration.showsCursor = false
        configuration.capturesAudio = false
        let filter = SCContentFilter(desktopIndependentWindow: window)
        let image = try await SCScreenshotManager.captureImage(
            contentFilter: filter,
            configuration: configuration
        )
        hasCapturedImage = true
        return image
    }
}

private final class BeliAutomation {
    private let configuration: AutomationConfiguration
    private let startStep: String
    private let capture: PhoneScreenshot
    private let visionQueue = DispatchQueue(label: "auto-beli.vision")
    private let eventSource = CGEventSource(stateID: .hidSystemState)

    init(configuration: AutomationConfiguration, startStep: String) async throws {
        self.configuration = configuration
        self.startStep = startStep
        capture = try await PhoneScreenshot()
    }

    func run() async throws {
        if startStep == "skip_photos" {
            try await skipPhotos()
            try await finishingInBeli()
            emit(type: "complete", step: nil, message: nil)
            return
        }
        guard let startIndex = Self.stepOrder.firstIndex(of: startStep) else {
            throw AutomationFailure.message("The retry checkpoint is invalid.")
        }
        if startIndex <= 0 { try await openingBeli() }
        if startIndex <= 1 { try await findingRestaurant() }
        if startIndex <= 2 { try await addingRating() }
        if startIndex <= 3 { try await choosingCategory() }
        if startIndex <= 4 { try await addingNotes() }
        if startIndex <= 5 { try await settingVisitDate() }
        if startIndex <= 6 { try await addingPhotos() }
        if startIndex <= 7 { try await finishingInBeli() }
        emit(type: "complete", step: nil, message: nil)
    }

    private func openingBeli() async throws {
        start("open_beli")
        activatePhoneWindow()
        _ = try await waitForText("beli", timeout: 90) { item in
            item.center.x < 0.32 && item.center.y < 0.25
        }
        finish("open_beli")
    }

    private func findingRestaurant() async throws {
        start("find_restaurant")
        let search = try await waitForText("search a restaurant", timeout: 30)
        try await clickDetectedTarget(search.center)
        try await pause(1.1)
        try typeText("\(configuration.restaurantName) \(configuration.address)")

        let currentLocation = try await waitForText("current location", timeout: 20)
        let prefix = String(configuration.restaurantName.prefix(10))
        let result = try await waitForText(prefix, timeout: 45) { item in
            item.center.y > currentLocation.center.y + 0.025
        }
        try await clickDetectedTarget(result.center)
        try await pause(1.5)
        finish("find_restaurant")
    }

    private func addingRating() async throws {
        start("add_rating")
        let plusPoint = try await waitForTealCircle(timeout: 25)
        try await clickThroughScreenshot(plusPoint)

        let label: String
        switch configuration.rating {
        case "liked": label = "i liked it"
        case "fine": label = "it was fine"
        case "disliked": label = "i didn’t like it"
        default: throw AutomationFailure.message("The selected rating is invalid.")
        }

        let ratingLabel = try await waitForText(label, timeout: 15)
        try await clickDetectedTarget(
            CGPoint(x: ratingLabel.center.x, y: max(0.05, ratingLabel.center.y - 0.055))
        )
        finish("add_rating")
    }

    private func choosingCategory() async throws {
        start("choose_category")
        let title = try await waitForText("choose a category", timeout: 20)
        let categoryLabel: String
        switch configuration.category {
        case "Restaurant": categoryLabel = "restaurants"
        case "Bar": categoryLabel = "bars"
        case "Coffee/Tea": categoryLabel = "coffee & tea"
        case "Bakery": categoryLabel = "bakeries"
        case "Dessert/Ice Cream": categoryLabel = "ice cream & dessert"
        default: categoryLabel = "restaurants"
        }
        let category = try await waitForText(categoryLabel, timeout: 15) {
            $0.center.y > title.center.y
        }
        try await clickDetectedTarget(category.center)
        finish("choose_category")
    }

    private func addingNotes() async throws {
        start("add_notes")
        if !configuration.description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let addNotes = try await waitForText("add notes", timeout: 20)
            try await clickDetectedTarget(addNotes.center)
            let textArea = try await waitForText("tips, tricks", timeout: 20)
            try await clickDetectedTarget(textArea.center)
            try typeText(configuration.description)
            let done = try await waitForText("done", timeout: 15) { $0.center.y < 0.18 }
            try await clickDetectedTarget(done.center)
        }
        finish("add_notes")
    }

    private func settingVisitDate() async throws {
        start("set_visit_date")
        guard let targetDate = Self.dateFormatter.date(from: configuration.visitDate) else {
            throw AutomationFailure.message("The visit date is invalid.")
        }

        let addDate = try await waitForText("add visit date", timeout: 20)
        try await clickDetectedTarget(addDate.center)

        var visibleMonth = try await readVisibleMonth(timeout: 20)
        let calendar = Calendar(identifier: .gregorian)
        let targetComponents = calendar.dateComponents([.year, .month], from: targetDate)
        var movements = 0

        while visibleMonth.year != targetComponents.year || visibleMonth.month != targetComponents.month {
            guard movements < 120 else {
                throw AutomationFailure.message("The visit month is too far from the displayed calendar.")
            }
            let currentIndex = visibleMonth.year * 12 + visibleMonth.month
            let targetIndex = (targetComponents.year ?? 0) * 12 + (targetComponents.month ?? 0)
            let goForward = targetIndex > currentIndex
            try await clickDetectedTarget(
                CGPoint(x: goForward ? 0.938 : 0.887, y: visibleMonth.y)
            )
            try await pause(0.45)
            visibleMonth = try await readVisibleMonth(timeout: 8)
            movements += 1
        }

        let day = calendar.component(.day, from: targetDate)
        let dayItem = try await waitForDay(day, date: targetDate, monthHeaderY: visibleMonth.y)
        try await clickDetectedTarget(dayItem.center)
        let done = try await waitForText("done", timeout: 15) { $0.center.y < 0.18 }
        try await clickDetectedTarget(done.center)
        finish("set_visit_date")
    }

    private func addingPhotos() async throws {
        start("add_photos")
        let addPhotos = try await waitForText("add photos", timeout: 20)
        try await clickDetectedTarget(addPhotos.center)
        let collections = try await waitForText("collections", timeout: 15) { $0.center.y < 0.2 }
        try await clickDetectedTarget(collections.center)
        try await pause(0.8)

        var album = try await findText("beli", timeout: 3) { item in
            item.center.y > 0.15
        }
        var albumScrolls = 0
        while album == nil && albumScrolls < 12 {
            scrollDown()
            try await pause(0.65)
            album = try await findText("beli", timeout: 3) { item in
                item.center.y > 0.15
            }
            albumScrolls += 1
        }
        guard let album else {
            throw AutomationFailure.message("The Beli photo album could not be found.")
        }
        try await clickDetectedTarget(album.center)
        _ = try await waitForText("beli", timeout: 20) { $0.center.y < 0.18 }

        let targets = configuration.photoPaths.compactMap(Self.loadImage)
        guard targets.count == configuration.photoPaths.count else {
            throw AutomationFailure.message("One of the meal photos could not be read.")
        }
        let selectedOrder = try await selectPhotos(targets)

        click(CGPoint(x: 0.938, y: 0.144))
        let descriptions = selectedOrder.map { index in
            guard let photoDescriptions = configuration.photoDescriptions,
                  photoDescriptions.indices.contains(index) else {
                return "Menu"
            }
            let value = photoDescriptions[index].trimmingCharacters(in: .whitespacesAndNewlines)
            return value.isEmpty ? "Menu" : value
        }
        try await addPhotoDescriptions(descriptions)
        let save = try await waitForText("save", timeout: 35) { $0.center.y < 0.18 }
        try await clickDetectedTarget(save.center)
        finish("add_photos")
    }

    private func addPhotoDescriptions(_ descriptions: [String]) async throws {
        _ = try await waitForText("photo upload", timeout: 20) { $0.center.y < 0.2 }

        for (index, description) in descriptions.enumerated() {
            var prompt: OCRItem?
            var scrolls = 0
            while prompt == nil && scrolls < 30 {
                let items = try recognizeText(in: await capture.image())
                prompt = items
                    .filter { item in
                        let text = normalize(item.text)
                        return text.contains("what s this") &&
                            item.center.y > 0.14 &&
                            item.center.y < 0.88
                    }
                    .min { $0.center.y < $1.center.y }
                if prompt == nil {
                    scrollPhotoUpload()
                    try await pause(0.55)
                    scrolls += 1
                }
            }
            guard let prompt else {
                throw AutomationFailure.message("A photo description field could not be found.")
            }

            try await clickDetectedTarget(prompt.center)
            _ = try await waitForText("description", timeout: 12) {
                $0.center.y < 0.2
            }
            try typeText(description)
            let done = try await waitForText("done", timeout: 12) {
                $0.center.y < 0.2
            }
            try await clickDetectedTarget(done.center)
            _ = try await waitForText("photo upload", timeout: 12) {
                $0.center.y < 0.2
            }
            emit(
                type: "diagnostic",
                step: "add_photos",
                message: "added photo description \(index + 1) of \(descriptions.count)"
            )
        }
    }

    private func finishingInBeli() async throws {
        start("finish_in_beli")
        let okay = try await waitForText("okay", timeout: 45) { $0.center.y > 0.72 }
        try await clickDetectedTarget(okay.center)

        var clearFrames = 0
        let deadline = Date().addingTimeInterval(20 * 60)
        while Date() < deadline {
            let items = try recognizeText(in: await capture.image(), level: .fast)
            let stillRating = items.contains { item in
                let text = normalize(item.text)
                return text.contains("how was it") ||
                    text.contains("i liked it") ||
                    text.contains("it was fine") ||
                    text.contains("i didnt like it") ||
                    text.contains("which do you prefer")
            }
            clearFrames = stillRating ? 0 : clearFrames + 1
            if clearFrames >= 3 {
                finish("finish_in_beli")
                return
            }
            try await pause(0.8)
        }
        throw AutomationFailure.message("Timed out while waiting for the Beli comparison flow.")
    }

    private func skipPhotos() async throws {
        start("add_photos")
        let pickerClosePoint = CGPoint(x: 0.107, y: 0.144)
        try await clickDetectedTarget(pickerClosePoint)
        try await pause(0.8)
        try await clickDetectedTarget(pickerClosePoint)
        try await pause(1)
        finish("add_photos")
    }

    private func selectPhotos(_ targetImages: [CGImage]) async throws -> [Int] {
        let targetFeatures = try targetImages.map {
            try Self.imageFeaturePrint(Self.centerSquare($0))
        }
        var remaining = Set(targetFeatures.indices)
        var previousGridFeature: [Float]?
        var unchangedPages = 0
        var page = 0
        var selectedOrder: [Int] = []

        while !remaining.isEmpty && page < 80 {
            let image = try await capture.image()
            savePhotoDebugImage(image)
            let cells = Self.gridCells(in: image)
            let cellFeatures = try cells.map { try Self.imageFeaturePrint($0.image) }
            var candidates: [(target: Int, cell: Int, distance: Float)] = []

            for targetIndex in remaining {
                for (cellIndex, cellFeature) in cellFeatures.enumerated() {
                    let distance = try Self.featurePrintDistance(
                        targetFeatures[targetIndex],
                        cellFeature
                    )
                    candidates.append((targetIndex, cellIndex, distance))
                }
            }
            candidates.sort { $0.distance < $1.distance }
            let bestDistance = candidates.first.map { String(format: "%.3f", $0.distance) } ?? "none"
            emit(
                type: "diagnostic",
                step: "add_photos",
                message: "photo page \(page): \(cells.count) cells, best distance \(bestDistance)"
            )

            if let candidate = candidates.first(where: { candidate in
                guard candidate.distance < 0.95 else { return false }
                let secondBest = candidates.first {
                    $0.target == candidate.target && $0.cell != candidate.cell
                }?.distance ?? .greatestFiniteMagnitude
                return candidate.distance + 0.08 < secondBest || candidate.distance < 0.72
            }) {
                try await clickDetectedTarget(cells[candidate.cell].point)
                remaining.remove(candidate.target)
                selectedOrder.append(candidate.target)
                try await pause(0.3)
                continue
            }

            let gridFeature = imageFeature(image)
            if let previousGridFeature,
               featureDistance(previousGridFeature, gridFeature) < 0.006 {
                unchangedPages += 1
            } else {
                unchangedPages = 0
            }
            if unchangedPages >= 2 { break }
            previousGridFeature = gridFeature
            scrollDown()
            try await pause(0.65)
            page += 1
        }

        guard remaining.isEmpty else {
            throw AutomationFailure.photosNotFound
        }
        return selectedOrder
    }

    private struct GridCell {
        let image: CGImage
        let point: CGPoint
    }

    private static func gridCells(in image: CGImage) -> [GridCell] {
        guard let separators = Self.photoGridSeparators(in: image) else { return [] }
        var cells: [GridCell] = []
        let expectedCellSize = separators.columns[2] - separators.columns[1]

        for row in 0..<(separators.rows.count - 1) {
            for column in 0..<(separators.columns.count - 1) {
                let left = separators.columns[column] + 3
                let right = separators.columns[column + 1] - 3
                let top = separators.rows[row] + 3
                let bottom = separators.rows[row + 1] - 3
                let rowHeight = separators.rows[row + 1] - separators.rows[row]
                guard right > left,
                      bottom > top,
                      rowHeight > expectedCellSize * 4 / 5,
                      rowHeight < expectedCellSize * 6 / 5,
                      let crop = image.cropping(to: CGRect(
                        x: left,
                        y: top,
                        width: right - left,
                        height: bottom - top
                      )) else {
                    continue
                }
                cells.append(GridCell(
                    image: crop,
                    point: CGPoint(
                        x: Double(left + right) / 2 / Double(image.width),
                        y: Double(top + bottom) / 2 / Double(image.height)
                    )
                ))
            }
        }
        return cells
    }

    private func savePhotoDebugImage(_ image: CGImage) {
        let debugDirectory = configuration.debugDirectory ?? configuration.photoPaths.first.map {
            URL(fileURLWithPath: $0).deletingLastPathComponent().path
        }
        guard let debugDirectory else { return }
        let url = URL(fileURLWithPath: debugDirectory).appendingPathComponent("photo-latest.png")
        try? Foundation.FileManager().removeItem(at: url)
        guard let destination = CGImageDestinationCreateWithURL(
            url as CFURL,
            "public.png" as CFString,
            1,
            nil
        ) else { return }
        CGImageDestinationAddImage(destination, image, nil)
        CGImageDestinationFinalize(destination)
    }

    private struct GridSeparators {
        let columns: [Int]
        let rows: [Int]
    }

    private static func photoGridSeparators(in image: CGImage) -> GridSeparators? {
        guard let pixels = Self.rgbaPixels(image) else { return nil }
        let width = image.width
        let height = image.height

        func luminance(x: Int, y: Int) -> Double {
            let offset = (y * width + x) * 4
            let red = Double(pixels[offset])
            let green = Double(pixels[offset + 1])
            let blue = Double(pixels[offset + 2])
            return (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255
        }

        func columnLuminance(_ x: Int) -> Double {
            let start = Int(Double(height) * 0.1)
            let end = Int(Double(height) * 0.82)
            var total = 0.0
            var count = 0
            for y in stride(from: start, to: end, by: 3) {
                total += luminance(x: x, y: y)
                count += 1
            }
            return count == 0 ? 1 : total / Double(count)
        }

        func darkestColumn(near center: Int) -> (position: Int, luminance: Double) {
            let radius = max(8, width / 16)
            let range = max(0, center - radius)...min(width - 1, center + radius)
            return range
                .map { ($0, columnLuminance($0)) }
                .min { $0.1 < $1.1 } ?? (center, 1)
        }

        let firstDivider = darkestColumn(near: width / 3)
        let secondDivider = darkestColumn(near: width * 2 / 3)
        let cellSize = secondDivider.position - firstDivider.position
        guard firstDivider.luminance < 0.28,
              secondDivider.luminance < 0.28,
              cellSize > width / 4,
              cellSize < width * 2 / 5 else {
            return nil
        }

        let left = max(0, firstDivider.position - cellSize)
        let right = min(width - 1, secondDivider.position + cellSize)

        func rowLuminance(_ y: Int) -> Double {
            var total = 0.0
            var count = 0
            for x in stride(from: left, through: right, by: 3) {
                total += luminance(x: x, y: y)
                count += 1
            }
            return count == 0 ? 1 : total / Double(count)
        }

        let searchRadius = max(5, cellSize / 32)
        func darkestRow(near center: Int) -> (position: Int, luminance: Double, contrast: Double) {
            let range = max(0, center - searchRadius)...min(height - 1, center + searchRadius)
            let outside = max(12, cellSize / 12)
            var best = (position: center, luminance: 1.0, contrast: 0.0)
            var bestScore = -Double.infinity
            for y in range {
                let value = rowLuminance(y)
                let before = rowLuminance(max(0, y - outside))
                let after = rowLuminance(min(height - 1, y + outside))
                let contrast = (before + after) / 2 - value
                let leadingEdge = max(0, before - value)
                let score = contrast + leadingEdge * 0.75 - value * 0.15
                if score > bestScore {
                    best = (y, value, contrast)
                    bestScore = score
                }
            }
            return best
        }

        let minimumY = Int(Double(height) * 0.04)
        let maximumY = Int(Double(height) * 0.93)
        var bestPhase: (phase: Int, hits: Int, darkness: Double)?

        for phase in 0..<cellSize {
            var predicted = phase
            while predicted < minimumY { predicted += cellSize }
            var hits = 0
            var darkness = 0.0
            while predicted <= maximumY {
                let row = darkestRow(near: predicted)
                if row.luminance < 0.32, row.contrast > 0.055 {
                    hits += 1
                    darkness += row.luminance
                }
                predicted += cellSize
            }
            if bestPhase == nil || hits > bestPhase!.hits ||
                (hits == bestPhase!.hits && darkness < bestPhase!.darkness) {
                bestPhase = (phase, hits, darkness)
            }
        }

        guard let bestPhase, bestPhase.hits >= 2 else { return nil }
        var rows: [Int] = []
        var predicted = bestPhase.phase
        while predicted < minimumY { predicted += cellSize }
        while predicted <= maximumY {
            let row = darkestRow(near: predicted)
            if row.luminance < 0.32,
               row.contrast > 0.055,
               rows.last.map({ abs($0 - row.position) > cellSize / 2 }) ?? true {
                rows.append(row.position)
            }
            predicted += cellSize
        }

        guard rows.count >= 2 else { return nil }
        return GridSeparators(
            columns: [left, firstDivider.position, secondDivider.position, right],
            rows: rows
        )
    }

    private func waitForDay(
        _ day: Int,
        date: Date,
        monthHeaderY: Double
    ) async throws -> OCRItem {
        let calendar = Calendar(identifier: .gregorian)
        let weekday = calendar.component(.weekday, from: date) - 1
        let firstOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: date))!
        let firstWeekday = calendar.component(.weekday, from: firstOfMonth) - 1
        let row = (firstWeekday + day - 1) / 7
        let expected = CGPoint(
            x: 0.119 + Double(weekday) * 0.127,
            y: monthHeaderY + 0.082 + Double(row) * 0.05
        )

        let deadline = Date().addingTimeInterval(15)
        while Date() < deadline {
            let items = try recognizeText(in: await capture.image())
            let candidates = items.filter {
                normalize($0.text) == String(day) &&
                    $0.center.y > monthHeaderY + 0.035 && $0.center.y < 0.72
            }
            if let closest = candidates.min(by: {
                distance($0.center, expected) < distance($1.center, expected)
            }) {
                return closest
            }
            try await pause(0.35)
        }
        throw AutomationFailure.message("The visit day could not be found in Beli's calendar.")
    }

    private func readVisibleMonth(timeout: TimeInterval) async throws -> (year: Int, month: Int, y: Double) {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            let items = try recognizeText(in: await capture.image())
            for item in items where item.center.y > 0.12 && item.center.y < 0.34 {
                let words = item.text
                    .replacingOccurrences(of: ",", with: " ")
                    .split(whereSeparator: { $0.isWhitespace })
                guard let monthWord = words.first,
                      let month = Self.months.firstIndex(where: {
                          $0.caseInsensitiveCompare(String(monthWord)) == .orderedSame
                      }),
                      let yearWord = words.first(where: { $0.count == 4 }),
                      let year = Int(yearWord) else { continue }
                return (year, month + 1, item.center.y)
            }
            try await pause(0.35)
        }
        throw AutomationFailure.message("Beli's visible calendar month could not be read.")
    }

    private func waitForText(
        _ target: String,
        timeout: TimeInterval,
        predicate: (OCRItem) -> Bool = { _ in true }
    ) async throws -> OCRItem {
        if let item = try await findText(target, timeout: timeout, predicate: predicate) {
            return item
        }
        throw AutomationFailure.message("Could not find “\(target)” in iPhone Mirroring.")
    }

    private func waitForTealCircle(timeout: TimeInterval) async throws -> CGPoint {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            let image = try await capture.image()
            if let point = Self.findTealCircle(in: image) {
                return point
            }
            try await pause(0.5)
        }
        throw AutomationFailure.message("The teal rating button could not be found.")
    }

    private func findText(
        _ target: String,
        timeout: TimeInterval,
        predicate: (OCRItem) -> Bool = { _ in true }
    ) async throws -> OCRItem? {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            let items = try recognizeText(in: await capture.image())
            if let match = bestTextMatch(target, in: items.filter(predicate)) {
                return match
            }
            try await pause(0.35)
        }
        return nil
    }

    private func recognizeText(
        in image: CGImage,
        level: VNRequestTextRecognitionLevel = .accurate
    ) throws -> [OCRItem] {
        try visionQueue.sync {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = level
            request.usesLanguageCorrection = true
            request.recognitionLanguages = ["en-US"]
            request.minimumTextHeight = 0.006
            let handler = VNImageRequestHandler(cgImage: image, options: [:])
            try handler.perform([request])
            return (request.results ?? []).compactMap { observation in
                guard let candidate = observation.topCandidates(1).first else { return nil }
                let box = observation.boundingBox
                return OCRItem(
                    text: candidate.string,
                    confidence: candidate.confidence,
                    x: box.minX,
                    y: 1 - box.maxY,
                    width: box.width,
                    height: box.height
                )
            }
        }
    }

    private func bestTextMatch(_ target: String, in items: [OCRItem]) -> OCRItem? {
        let needle = normalize(target)
        return items
            .filter { item in
                let value = normalize(item.text)
                return value.contains(needle) || needle.contains(value)
            }
            .max { first, second in
                let firstExact = normalize(first.text) == needle ? 1 : 0
                let secondExact = normalize(second.text) == needle ? 1 : 0
                if firstExact != secondExact { return firstExact < secondExact }
                return first.confidence < second.confidence
            }
    }

    private func activatePhoneWindow() {
        guard let app = NSRunningApplication(processIdentifier: capture.window.owningApplication?.processID ?? 0) else {
            return
        }
        app.activate(options: [])
    }

    private func click(_ normalizedPoint: CGPoint) {
        activatePhoneWindow()
        let point = CGPoint(
            x: capture.window.frame.minX + normalizedPoint.x * capture.window.frame.width,
            y: capture.window.frame.minY + normalizedPoint.y * capture.window.frame.height
        )
        let down = CGEvent(mouseEventSource: eventSource, mouseType: .leftMouseDown, mouseCursorPosition: point, mouseButton: .left)
        let up = CGEvent(mouseEventSource: eventSource, mouseType: .leftMouseUp, mouseCursorPosition: point, mouseButton: .left)
        down?.post(tap: .cghidEventTap)
        usleep(55_000)
        up?.post(tap: .cghidEventTap)
    }

    private func clickThroughScreenshot(_ normalizedPoint: CGPoint) async throws {
        try await pause(0.25)
        click(normalizedPoint)
        try await pause(1)
        click(normalizedPoint)
    }

    private func clickDetectedTarget(_ normalizedPoint: CGPoint) async throws {
        click(normalizedPoint)
        try await pause(0.35)
    }

    private func scrollDown() {
        activatePhoneWindow()
        let point = globalPoint(CGPoint(x: 0.5, y: 0.62))
        CGWarpMouseCursorPosition(point)
        CGEvent(
            mouseEventSource: eventSource,
            mouseType: .mouseMoved,
            mouseCursorPosition: point,
            mouseButton: .left
        )?.post(tap: .cghidEventTap)
        usleep(70_000)
        for _ in 0..<2 {
            CGEvent(
                scrollWheelEvent2Source: eventSource,
                units: .pixel,
                wheelCount: 1,
                wheel1: -320,
                wheel2: 0,
                wheel3: 0
            )?.post(tap: .cghidEventTap)
            usleep(45_000)
        }
    }

    private func scrollPhotoUpload() {
        activatePhoneWindow()
        let point = globalPoint(CGPoint(x: 0.5, y: 0.7))
        CGWarpMouseCursorPosition(point)
        CGEvent(
            mouseEventSource: eventSource,
            mouseType: .mouseMoved,
            mouseCursorPosition: point,
            mouseButton: .left
        )?.post(tap: .cghidEventTap)
        usleep(70_000)
        CGEvent(
            scrollWheelEvent2Source: eventSource,
            units: .pixel,
            wheelCount: 1,
            wheel1: -260,
            wheel2: 0,
            wheel3: 0
        )?.post(tap: .cghidEventTap)
    }

    private func globalPoint(_ normalizedPoint: CGPoint) -> CGPoint {
        CGPoint(
            x: capture.window.frame.minX + normalizedPoint.x * capture.window.frame.width,
            y: capture.window.frame.minY + normalizedPoint.y * capture.window.frame.height
        )
    }

    private func typeText(_ text: String) throws {
        activatePhoneWindow()
        let typing = Process()
        typing.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
        typing.arguments = [
            "-e",
            "on run argv",
            "-e",
            "set inputText to item 1 of argv",
            "-e",
            "tell application \"System Events\"",
            "-e",
            "repeat with currentCharacter in characters of inputText",
            "-e",
            "keystroke (currentCharacter as text)",
            "-e",
            "delay 0.01",
            "-e",
            "end repeat",
            "-e",
            "end tell",
            "-e",
            "end run",
            "--",
            text,
        ]
        typing.standardOutput = FileHandle.nullDevice
        typing.standardError = FileHandle.nullDevice
        try typing.run()
        typing.waitUntilExit()
        guard typing.terminationStatus == 0 else {
            throw AutomationFailure.message("macOS could not type into iPhone Mirroring.")
        }
        usleep(500_000)
    }

    private static func findTealCircle(in image: CGImage) -> CGPoint? {
        guard let pixels = rgbaPixels(image) else { return nil }
        let width = image.width
        let height = image.height
        let radius = Double(width) * 0.034
        var best: (x: Int, y: Int, score: Int)?

        func isTeal(x: Int, y: Int) -> Bool {
            guard x >= 0, x < width, y >= 0, y < height else { return false }
            let offset = (y * width + x) * 4
            let red = Int(pixels[offset])
            let green = Int(pixels[offset + 1])
            let blue = Int(pixels[offset + 2])
            return green > red + 12 && blue > red + 12 && green > 65 && blue > 65
        }

        for y in stride(
            from: Int(Double(height) * 0.36),
            to: Int(Double(height) * 0.47),
            by: 2
        ) {
            for x in stride(
                from: Int(Double(width) * 0.72),
                to: Int(Double(width) * 0.84),
                by: 2
            ) {
                var score = 0
                for sample in 0..<40 {
                    let angle = Double(sample) / 40 * .pi * 2
                    let sampleX = x + Int(cos(angle) * radius)
                    let sampleY = y + Int(sin(angle) * radius)
                    if isTeal(x: sampleX, y: sampleY) { score += 1 }
                }
                if best == nil || score > best!.score {
                    best = (x, y, score)
                }
            }
        }

        guard let best, best.score >= 8 else { return nil }
        return CGPoint(
            x: Double(best.x) / Double(width),
            y: Double(best.y) / Double(height)
        )
    }

    private func pause(_ seconds: Double) async throws {
        try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
    }

    private func start(_ step: String) {
        emit(type: "progress", step: step, message: nil)
    }

    private func finish(_ step: String) {
        emit(type: "finished", step: step, message: nil)
    }

    private func emit(type: String, step: String?, message: String?) {
        var payload: [String: String] = ["type": type]
        if let step { payload["step"] = step }
        if let message { payload["message"] = message }
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let line = String(data: data, encoding: .utf8) else { return }
        print(line)
        fflush(stdout)
    }

    private func normalize(_ string: String) -> String {
        string
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .replacingOccurrences(of: "[^a-z0-9]+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func distance(_ first: CGPoint, _ second: CGPoint) -> Double {
        hypot(first.x - second.x, first.y - second.y)
    }

    private static func rgbaPixels(_ image: CGImage) -> [UInt8]? {
        var pixels = [UInt8](repeating: 0, count: image.width * image.height * 4)
        guard let context = CGContext(
            data: &pixels,
            width: image.width,
            height: image.height,
            bitsPerComponent: 8,
            bytesPerRow: image.width * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }
        context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        return pixels
    }

    private static func centerSquare(_ image: CGImage) -> CGImage {
        let side = min(image.width, image.height)
        let cropRect = CGRect(
            x: (image.width - side) / 2,
            y: (image.height - side) / 2,
            width: side,
            height: side
        )
        return image.cropping(to: cropRect) ?? image
    }

    private static func imageFeaturePrint(_ image: CGImage) throws -> VNFeaturePrintObservation {
        let request = VNGenerateImageFeaturePrintRequest()
        let handler = VNImageRequestHandler(cgImage: image, options: [:])
        try handler.perform([request])
        guard let observation = request.results?.first as? VNFeaturePrintObservation else {
            throw AutomationFailure.message("A photo could not be analyzed.")
        }
        return observation
    }

    private static func featurePrintDistance(
        _ first: VNFeaturePrintObservation,
        _ second: VNFeaturePrintObservation
    ) throws -> Float {
        var distance: Float = 0
        try first.computeDistance(&distance, to: second)
        return distance
    }

    private func imageFeature(_ image: CGImage) -> [Float] {
        let size = 16
        var pixels = [UInt8](repeating: 0, count: size * size * 4)
        guard let context = CGContext(
            data: &pixels,
            width: size,
            height: size,
            bitsPerComponent: 8,
            bytesPerRow: size * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return [] }

        let side = min(image.width, image.height)
        let cropRect = CGRect(
            x: (image.width - side) / 2,
            y: (image.height - side) / 2,
            width: side,
            height: side
        )
        guard let crop = image.cropping(to: cropRect) else { return [] }
        context.interpolationQuality = .medium
        context.draw(crop, in: CGRect(x: 0, y: 0, width: size, height: size))

        var result: [Float] = []
        result.reserveCapacity(size * size * 3)
        for offset in stride(from: 0, to: pixels.count, by: 4) {
            result.append(Float(pixels[offset]) / 255)
            result.append(Float(pixels[offset + 1]) / 255)
            result.append(Float(pixels[offset + 2]) / 255)
        }
        return result
    }

    private func featureDistance(_ first: [Float], _ second: [Float]) -> Float {
        guard first.count == second.count, !first.isEmpty else { return 1 }
        var total: Float = 0
        for index in first.indices {
            let delta = first[index] - second[index]
            total += delta * delta
        }
        return sqrt(total / Float(first.count))
    }

    private static func loadImage(_ path: String) -> CGImage? {
        let url = URL(fileURLWithPath: path) as CFURL
        guard let source = CGImageSourceCreateWithURL(url, nil) else { return nil }
        return CGImageSourceCreateImageAtIndex(source, 0, [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceThumbnailMaxPixelSize: 1_024,
            kCGImageSourceCreateThumbnailWithTransform: true,
        ] as CFDictionary)
    }

    private static let months = Calendar.current.monthSymbols
    private static let stepOrder = [
        "open_beli",
        "find_restaurant",
        "add_rating",
        "choose_category",
        "add_notes",
        "set_visit_date",
        "add_photos",
        "finish_in_beli",
    ]
    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

private func runOCRFixture(path: String) throws {
    guard let image = BeliAutomation.loadFixtureImage(path) else {
        throw AutomationFailure.message("The fixture image could not be read.")
    }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.minimumTextHeight = 0.006
    try VNImageRequestHandler(cgImage: image).perform([request])
    let items = (request.results ?? []).compactMap { observation -> OCRItem? in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        let box = observation.boundingBox
        return OCRItem(
            text: candidate.string,
            confidence: candidate.confidence,
            x: box.minX,
            y: 1 - box.maxY,
            width: box.width,
            height: box.height
        )
    }
    let data = try JSONEncoder().encode(items)
    print(String(decoding: data, as: UTF8.self))
}

private func requireAutomationPermissions() throws {
    let accessibilityOptions = [
        kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true,
    ] as CFDictionary
    guard AXIsProcessTrustedWithOptions(accessibilityOptions) else {
        throw AutomationFailure.message(
            "Allow Auto Beli in System Settings → Privacy & Security → Accessibility, then try again."
        )
    }
    guard CGPreflightScreenCaptureAccess() || CGRequestScreenCaptureAccess() else {
        throw AutomationFailure.message(
            "Allow Auto Beli in System Settings → Privacy & Security → Screen & System Audio Recording, then try again."
        )
    }
}

private extension BeliAutomation {
    static func loadFixtureImage(_ path: String) -> CGImage? {
        loadImage(path)
    }

    static func tealFixturePoint(_ image: CGImage) -> CGPoint? {
        findTealCircle(in: image)
    }

    static func gridFixtureDescription(_ image: CGImage) -> String? {
        guard let separators = photoGridSeparators(in: image) else { return nil }
        return "columns=\(separators.columns.map(String.init).joined(separator: ",")) rows=\(separators.rows.map(String.init).joined(separator: ","))"
    }

    static func matchFixtureDescription(screen: CGImage, target: CGImage) throws -> String {
        let targetFeature = try imageFeaturePrint(centerSquare(target))
        let distances = try gridCells(in: screen).enumerated().map { index, cell in
            let cellFeature = try imageFeaturePrint(cell.image)
            let distance = try featurePrintDistance(targetFeature, cellFeature)
            return (index, distance)
        }.sorted { $0.1 < $1.1 }
        return distances.prefix(5).map {
            "\($0.0):\(String(format: "%.3f", $0.1))"
        }.joined(separator: " ")
    }
}

@main
private struct Main {
    static func main() async {
        do {
            if CommandLine.arguments.count == 3, CommandLine.arguments[1] == "--ocr" {
                try runOCRFixture(path: CommandLine.arguments[2])
                return
            }
            if CommandLine.arguments.count == 3, CommandLine.arguments[1] == "--teal" {
                guard let image = BeliAutomation.loadFixtureImage(CommandLine.arguments[2]),
                      let point = BeliAutomation.tealFixturePoint(image) else {
                    throw AutomationFailure.message("No teal circle was found.")
                }
                print("\(point.x),\(point.y)")
                return
            }
            if CommandLine.arguments.count == 3, CommandLine.arguments[1] == "--grid" {
                guard let image = BeliAutomation.loadFixtureImage(CommandLine.arguments[2]),
                      let description = BeliAutomation.gridFixtureDescription(image) else {
                    throw AutomationFailure.message("No photo grid was found.")
                }
                print(description)
                return
            }
            if CommandLine.arguments.count == 4, CommandLine.arguments[1] == "--match" {
                guard let screen = BeliAutomation.loadFixtureImage(CommandLine.arguments[2]),
                      let target = BeliAutomation.loadFixtureImage(CommandLine.arguments[3]) else {
                    throw AutomationFailure.message("A match fixture could not be read.")
                }
                print(try BeliAutomation.matchFixtureDescription(screen: screen, target: target))
                return
            }
            guard [3, 4, 5].contains(CommandLine.arguments.count),
                  CommandLine.arguments[1] == "--config" else {
                throw AutomationFailure.message(
                    "Usage: beli-automation --config <config.json> [--start-step <step> | --skip-photos]"
                )
            }
            let startStep: String
            if CommandLine.arguments.count == 4 {
                guard CommandLine.arguments[3] == "--skip-photos" else {
                    throw AutomationFailure.message("The recovery arguments are invalid.")
                }
                startStep = "skip_photos"
            } else if CommandLine.arguments.count == 5 {
                guard CommandLine.arguments[3] == "--start-step" else {
                    throw AutomationFailure.message("The retry arguments are invalid.")
                }
                startStep = CommandLine.arguments[4]
            } else {
                startStep = "open_beli"
            }
            try requireAutomationPermissions()
            let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[2]))
            let configuration = try JSONDecoder().decode(AutomationConfiguration.self, from: data)
            let automation = try await BeliAutomation(
                configuration: configuration,
                startStep: startStep
            )
            try await automation.run()
        } catch {
            let message = error.localizedDescription
            var payload = [
                "type": "error",
                "message": message,
            ]
            if let failure = error as? AutomationFailure,
               let code = failure.recoveryCode {
                payload["code"] = code
            }
            if let data = try? JSONSerialization.data(withJSONObject: payload),
               let line = String(data: data, encoding: .utf8) {
                print(line)
                fflush(stdout)
            }
            fputs("\(message)\n", stderr)
            exit(1)
        }
    }
}
